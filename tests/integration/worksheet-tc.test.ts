/**
 * Test case worksheet Modul 11 (Software Testing), 26 kasus TC-01 .. TC-26.
 *
 * Alokasi per operasi mengikuti profil operasional di docs/pengujian.md
 * (rumus modul: 130 menit x 3 penguji / 15 menit = 26 test case). Judul tiap
 * `it` diawali ID kasus supaya hasil Vitest (JSON) bisa dipetakan ke tabel
 * worksheet oleh scripts/laporan-pengujian.ts.
 *
 * Ekspektasi ditulis dari spesifikasi (docs/architecture.md dan JSDoc rute),
 * bukan dari perilaku yang kebetulan ada. Kasus yang gagal dilaporkan apa
 * adanya sebagai failure.
 */

import { describe, expect, it } from "vitest";

import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as checkinPost } from "@/app/api/checkins/route";
import { POST as estimatePost } from "@/app/api/meals/[id]/estimate/route";
import { GET as mealsGet, POST as mealsPost } from "@/app/api/meals/route";
import { GET as dailyGet } from "@/app/api/nutrition/daily/route";
import { PATCH as profilePatch } from "@/app/api/profile/route";
import { POST as rekomendasiPost } from "@/app/api/recommendations/route";
import { GET as schedulesGet, POST as schedulesPost } from "@/app/api/schedules/route";
import { GET as trendsGet } from "@/app/api/trends/weekly/route";
import { autentikasiKredensial } from "@/lib/services/login";
import { hitungTargetGizi } from "@/lib/services/nutrition-target";

import {
  ESTIMASI_CONTOH,
  buatRequest,
  buatUser,
  emailUnik,
  get,
  masukSebagai,
  pakaiDbBersih,
  paramsId,
  pasangAzureOpenAI,
  patch,
  post,
  prisma,
} from "./helpers";

pakaiDbBersih();

const SIANG_WIB = "2026-11-21T12:00:00+07:00";
const TANGGAL = "2026-11-21";
const PASSWORD = "rahasia-sekali-123";

async function penggunaDenganTarget(nama = "Mahasiswa Uji") {
  const user = await buatUser(nama);
  await prisma.nutritionTarget.create({
    data: {
      user_id: user.id,
      kalori_target: 2000,
      protein_target_g: 60,
      karbohidrat_target_g: 300,
      lemak_target_g: 60,
      zat_besi_target_mg: 18,
      berlaku_sejak: new Date("2020-01-01"),
    },
  });
  masukSebagai(user.id);
  return user;
}

const catat = (body: Record<string, unknown>) => mealsPost(post("/api/meals", body));
const checkin = (body: Record<string, unknown>) => checkinPost(post("/api/checkins", body));
const meal = (userId: string, waktu: string, teks = "nasi telur") =>
  prisma.mealLog.create({ data: { user_id: userId, teks_input: teks, waktu_makan: new Date(waktu) } });

// ---------------------------------------------------------------------------
// Register (2)
// ---------------------------------------------------------------------------

describe("Register", () => {
  it("TC-01 [positif] daftar dengan email, password, dan nama valid: 201 dan password tersimpan sebagai hash argon2id", async () => {
    const email = emailUnik("tc01");
    const res = await registerPost(post("/api/auth/register", { email, password: PASSWORD, nama: "Mahasiswa Uji" }));

    expect(res.status).toBe(201);
    const baris = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(baris.password_hash).toMatch(/^\$argon2id\$/);
    expect(baris.password_hash).not.toContain(PASSWORD);
  });

  it("TC-02 [negatif] daftar dengan email yang sudah terdaftar: 409 EMAIL_TAKEN dan tidak ada akun ganda", async () => {
    const email = emailUnik("tc02");
    await registerPost(post("/api/auth/register", { email, password: PASSWORD, nama: "Satu" }));

    const res = await registerPost(post("/api/auth/register", { email, password: PASSWORD, nama: "Dua" }));

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("EMAIL_TAKEN");
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Login (3)
// ---------------------------------------------------------------------------

describe("Login", () => {
  async function akunTerdaftar() {
    const email = emailUnik("login");
    await registerPost(post("/api/auth/register", { email, password: PASSWORD, nama: "Mahasiswa Login" }));
    return email;
  }

  it("TC-03 [positif] login dengan email dan password benar: pengguna dikembalikan", async () => {
    const email = await akunTerdaftar();

    const hasil = await autentikasiKredensial({ email, password: PASSWORD });

    expect(hasil).toMatchObject({ email, name: "Mahasiswa Login" });
    expect(hasil?.id).toBeTruthy();
  });

  it("TC-04 [negatif] login dengan password salah: ditolak", async () => {
    const email = await akunTerdaftar();

    expect(await autentikasiKredensial({ email, password: "password-yang-salah" })).toBeNull();
  });

  it("TC-05 [negatif] login dengan email yang belum terdaftar: ditolak", async () => {
    expect(await autentikasiKredensial({ email: emailUnik("tidakada"), password: PASSWORD })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Catat makan (6)
// ---------------------------------------------------------------------------

describe("Catat makan", () => {
  it("TC-06 [positif] teks makanan valid dan AI berhasil: 201, catatan dan estimasi gizi tersimpan", async () => {
    const user = await penggunaDenganTarget();
    pasangAzureOpenAI();

    const res = await catat({ teks_input: "nasi telur dadar", waktu_makan: SIANG_WIB });

    expect(res.status).toBe(201);
    const badan = await res.json();
    expect(badan.estimasi_tertunda).toBe(false);
    expect(badan.meal.estimasi).toMatchObject({ protein_g: ESTIMASI_CONTOH.protein_g, kalori_estimasi: 520 });
    expect(await prisma.mealLog.count({ where: { user_id: user.id } })).toBe(1);
    expect(await prisma.nutritionEstimate.count()).toBe(1);
  });

  it("TC-07 [negatif] teks makanan kosong: 400 VALIDATION_ERROR dan tidak ada catatan", async () => {
    await penggunaDenganTarget();
    const azure = pasangAzureOpenAI();

    const res = await catat({ teks_input: "   " });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.mealLog.count()).toBe(0);
    expect(azure.panggilan).toBe(0);
  });

  it("TC-08 [negatif] mencatat makan tanpa login: 401 UNAUTHORIZED", async () => {
    pasangAzureOpenAI();

    const res = await catat({ teks_input: "nasi goreng" });

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    expect(await prisma.mealLog.count()).toBe(0);
  });

  it("TC-09 [positif] layanan AI gagal (HTTP 500): catatan tetap tersimpan, 201 dengan estimasi_tertunda", async () => {
    const user = await penggunaDenganTarget();
    pasangAzureOpenAI("http500");

    const res = await catat({ teks_input: "nasi goreng", waktu_makan: SIANG_WIB });

    expect(res.status).toBe(201);
    const badan = await res.json();
    expect(badan.estimasi_tertunda).toBe(true);
    expect(badan.meal.estimasi).toBeNull();
    expect(await prisma.mealLog.count({ where: { user_id: user.id } })).toBe(1);
    expect(await prisma.nutritionEstimate.count()).toBe(0);
  });

  it("TC-10 [negatif] teks makanan 501 karakter (melebihi batas 500): 400 dan AI tidak dipanggil", async () => {
    await penggunaDenganTarget();
    const azure = pasangAzureOpenAI();

    const res = await catat({ teks_input: "a".repeat(501) });

    expect(res.status).toBe(400);
    expect(azure.panggilan).toBe(0);
    expect(await prisma.mealLog.count()).toBe(0);
  });

  it("TC-11 [negatif] total harga negatif: 400 VALIDATION_ERROR", async () => {
    await penggunaDenganTarget();
    pasangAzureOpenAI();

    const res = await catat({ teks_input: "nasi goreng", total_harga: -5000 });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.mealLog.count()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Gizi harian (4)
// ---------------------------------------------------------------------------

describe("Gizi harian", () => {
  it("TC-12 [positif] hari berisi dua catatan: asupan sama dengan jumlah estimasi dan kesenjangan = target - asupan", async () => {
    await penggunaDenganTarget();
    pasangAzureOpenAI();
    await catat({ teks_input: "nasi telur", waktu_makan: "2026-11-21T08:00:00+07:00" });
    await catat({ teks_input: "ayam geprek", waktu_makan: "2026-11-21T13:00:00+07:00" });

    const res = await dailyGet(get(`/api/nutrition/daily?tanggal=${TANGGAL}`));

    expect(res.status).toBe(200);
    const { gizi_harian: g } = await res.json();
    expect(g.tanggal).toBe(TANGGAL);
    expect(g.jumlah_catatan).toBe(2);
    expect(g.asupan.protein_g).toBe(40); // 2 x 20 g
    expect(g.asupan.kalori).toBe(1040); // 2 x 520
    const protein = g.kesenjangan.find((k: { zat: string }) => k.zat === "protein_g");
    expect(protein).toMatchObject({ target: 60, asupan: 40, kurang: 20 });
  });

  it("TC-13 [positif] hari tanpa catatan: asupan nol dan seluruh target tampil sebagai kekurangan", async () => {
    await penggunaDenganTarget();

    const res = await dailyGet(get("/api/nutrition/daily?tanggal=2026-11-20"));

    expect(res.status).toBe(200);
    const { gizi_harian: g } = await res.json();
    expect(g.jumlah_catatan).toBe(0);
    expect(g.asupan).toMatchObject({ protein_g: 0, karbohidrat_g: 0, lemak_g: 0, zat_besi_mg: 0, kalori: 0 });
    expect(g.kesenjangan).toHaveLength(4);
    for (const k of g.kesenjangan) expect(k.kurang).toBe(k.target);
  });

  it("TC-14 [negatif] tanggal tidak ada di kalender (2026-02-31): 400 VALIDATION_ERROR", async () => {
    await penggunaDenganTarget();

    const res = await dailyGet(get("/api/nutrition/daily?tanggal=2026-02-31"));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("TC-15 [positif] batas hari WIB: makan 23:30 WIB masuk hari itu, 00:30 WIB masuk hari berikutnya", async () => {
    const user = await penggunaDenganTarget();
    pasangAzureOpenAI();
    await catat({ teks_input: "nasi malam", waktu_makan: "2026-11-21T23:30:00+07:00" });
    await catat({ teks_input: "mi tengah malam", waktu_makan: "2026-11-22T00:30:00+07:00" });

    const hari21 = (await (await dailyGet(get("/api/nutrition/daily?tanggal=2026-11-21"))).json()).gizi_harian;
    const hari22 = (await (await dailyGet(get("/api/nutrition/daily?tanggal=2026-11-22"))).json()).gizi_harian;

    expect(hari21.jumlah_catatan).toBe(1);
    expect(hari22.jumlah_catatan).toBe(1);
    expect(await prisma.mealLog.count({ where: { user_id: user.id } })).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Check-in energi dan fokus (3)
// ---------------------------------------------------------------------------

describe("Check-in", () => {
  it("TC-16 [positif] check-in energi 4 dan fokus 3 untuk catatan milik sendiri: 201 dan tersimpan atas user sesi", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    const m = await meal(user.id, SIANG_WIB);

    const res = await checkin({ meal_log_id: m.id, tingkat_energi: 4, tingkat_fokus: 3 });

    expect(res.status).toBe(201);
    const baris = await prisma.checkin.findFirstOrThrow({ where: { meal_log_id: m.id } });
    expect(baris).toMatchObject({ user_id: user.id, tingkat_energi: 4, tingkat_fokus: 3 });
  });

  it("TC-17 [negatif] tingkat energi 6 (di luar skala 1-5): 400 dan tidak tersimpan", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    const m = await meal(user.id, SIANG_WIB);

    const res = await checkin({ meal_log_id: m.id, tingkat_energi: 6, tingkat_fokus: 3 });

    expect(res.status).toBe(400);
    expect(await prisma.checkin.count()).toBe(0);
  });

  it("TC-18 [negatif] check-in untuk catatan makan milik pengguna lain: 404 dan tidak tersimpan", async () => {
    const pemilik = await buatUser("Pemilik");
    const orangLain = await buatUser("Orang Lain");
    const m = await meal(pemilik.id, SIANG_WIB);
    masukSebagai(orangLain.id);

    const res = await checkin({ meal_log_id: m.id, tingkat_energi: 3, tingkat_fokus: 3 });

    expect(res.status).toBe(404);
    expect(await prisma.checkin.count()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Riwayat makan (2)
// ---------------------------------------------------------------------------

describe("Riwayat makan", () => {
  it("TC-19 [positif] riwayat satu hari: hanya catatan hari itu, terbaru dulu", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    const pagi = await meal(user.id, "2026-11-21T07:00:00+07:00", "bubur");
    const malam = await meal(user.id, "2026-11-21T19:00:00+07:00", "nasi goreng");
    await meal(user.id, "2026-11-20T12:00:00+07:00", "kemarin");

    const res = await mealsGet(get(`/api/meals?tanggal=${TANGGAL}`));

    expect(res.status).toBe(200);
    const badan = await res.json();
    expect(badan.count).toBe(2);
    expect(badan.meals.map((m: { id: string }) => m.id)).toEqual([malam.id, pagi.id]);
  });

  it("TC-20 [negatif] riwayat tidak memuat catatan pengguna lain", async () => {
    const saya = await buatUser("Saya");
    const lain = await buatUser("Lain");
    await meal(lain.id, SIANG_WIB, "rahasia orang lain");
    masukSebagai(saya.id);

    const badan = await (await mealsGet(get(`/api/meals?tanggal=${TANGGAL}`))).json();

    expect(badan.count).toBe(0);
    expect(JSON.stringify(badan)).not.toContain("rahasia orang lain");
  });
});

// ---------------------------------------------------------------------------
// Rekomendasi warung (2)
// ---------------------------------------------------------------------------

describe("Rekomendasi", () => {
  const POSISI = { latitude: -6.2, longitude: 106.8166 };

  it("TC-21 [positif] anggaran Rp20.000: hanya menu dalam anggaran dari warung yang buka dan terjangkau", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    const [{ id: vendorId }] = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO vendors (id, nama_warung, jenis_vendor, alamat, latitude, longitude, jam_buka, jam_tutup)
      VALUES (gen_random_uuid(), 'Warteg Uji', 'warteg', 'Jl. Uji', -6.201, 106.817, '08:00'::time, '21:00'::time)
      RETURNING id`;
    await prisma.menuItem.create({
      data: { vendor_id: vendorId, nama_menu: "Nasi Ayam", estimasi_harga: 15000, estimasi_kalori: 400, estimasi_protein_g: 25, tersedia: true },
    });
    await prisma.menuItem.create({
      data: { vendor_id: vendorId, nama_menu: "Steak Mahal", estimasi_harga: 50000, estimasi_kalori: 600, estimasi_protein_g: 40, tersedia: true },
    });

    const res = await rekomendasiPost(
      post("/api/recommendations", {
        ...POSISI,
        batas_anggaran: 20000,
        sela_waktu_menit: 120,
        waktu: "2026-11-21T05:00:00.000Z",
      }),
    );

    expect(res.status).toBe(200);
    const badan = await res.json();
    expect(badan.recommendations.map((r: { nama_menu: string }) => r.nama_menu)).toEqual(["Nasi Ayam"]);
    expect(badan.recommendations[0].estimasi_harga).toBeLessThanOrEqual(20000);
  });

  it("TC-22 [negatif] latitude 200 (di luar -90..90): 400 VALIDATION_ERROR", async () => {
    const user = await buatUser();
    masukSebagai(user.id);

    const res = await rekomendasiPost(
      post("/api/recommendations", { latitude: 200, longitude: 106.8, batas_anggaran: 20000, sela_waktu_menit: 120 }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });
});

// ---------------------------------------------------------------------------
// Tren mingguan (1)
// ---------------------------------------------------------------------------

describe("Tren mingguan", () => {
  it("TC-23 [positif] tiga check-in dalam satu minggu: status ok, rata-rata energi dan fokus dihitung benar, disclaimer ada", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    pasangAzureOpenAI();
    const data = [
      { waktu: "2026-11-16T12:00:00+07:00", e: 5, f: 2 },
      { waktu: "2026-11-18T12:00:00+07:00", e: 3, f: 3 },
      { waktu: "2026-11-20T12:00:00+07:00", e: 4, f: 4 },
    ];
    for (const d of data) {
      const m = await meal(user.id, d.waktu);
      await prisma.checkin.create({
        data: { user_id: user.id, meal_log_id: m.id, tingkat_energi: d.e, tingkat_fokus: d.f },
      });
    }

    const res = await trendsGet(get("/api/trends/weekly?minggu=2026-11-18"));

    expect(res.status).toBe(200);
    const badan = await res.json();
    expect(badan.minggu).toEqual({ mulai: "2026-11-16", selesai: "2026-11-22" });
    expect(badan.status).toBe("ok");
    expect(badan.jumlah_checkin).toBe(3);
    expect(badan.rata_energi).toBe(4);
    expect(badan.rata_fokus).toBe(3);
    expect(badan.disclaimer).toContain("bukan diagnosis medis");
  });
});

// ---------------------------------------------------------------------------
// Atur profil (1)
// ---------------------------------------------------------------------------

describe("Atur profil", () => {
  it("TC-24 [positif] isi data fisik: target gizi dihitung dari rumus dan tersimpan", async () => {
    const user = await buatUser();
    masukSebagai(user.id);

    const res = await profilePatch(
      patch("/api/profile", {
        tanggal_lahir: "2003-05-10",
        jenis_kelamin: "P",
        berat_badan_kg: 55.5,
        tinggi_badan_cm: 160,
      }),
    );

    expect(res.status).toBe(200);
    const harapan = hitungTargetGizi({
      tanggal_lahir: new Date("2003-05-10"),
      jenis_kelamin: "P",
      berat_badan_kg: 55.5,
      tinggi_badan_cm: 160,
    });
    const target = await prisma.nutritionTarget.findFirstOrThrow({ where: { user_id: user.id } });
    expect(target.kalori_target).toBe(harapan.kalori_target);
    expect(Number(target.protein_target_g)).toBe(harapan.protein_target_g);
    // Nilai independen dari rumus: perempuan, berat 55,5 kg, tinggi 160 cm, usia bergeser seiring waktu.
    // Rentang lebar supaya tidak bergantung pada hari tes dijalankan (usia 20-35 th).
    expect(target.kalori_target).toBeGreaterThanOrEqual(1600);
    expect(target.kalori_target).toBeLessThanOrEqual(1800);
    expect(Number(target.zat_besi_target_mg)).toBe(18);
  });
});

// ---------------------------------------------------------------------------
// Kelola jadwal kuliah (1)
// ---------------------------------------------------------------------------

describe("Kelola jadwal kuliah", () => {
  it("TC-25 [negatif] jam selesai lebih awal dari jam mulai: 400 dan jadwal tidak tersimpan", async () => {
    const user = await buatUser();
    masukSebagai(user.id);

    const res = await schedulesPost(
      post("/api/schedules", { mata_kuliah: "Basis Data", hari: 2, jam_mulai: "10:00", jam_selesai: "08:00" }),
    );

    expect(res.status).toBe(400);
    expect(await prisma.classSchedule.count()).toBe(0);
    const daftar = await (await schedulesGet()).json();
    expect(daftar.schedules).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Reproses estimasi (1)
// ---------------------------------------------------------------------------

describe("Reproses estimasi", () => {
  it("TC-26 [positif] AI pulih setelah gagal: reproses melengkapi estimasi catatan yang tertunda", async () => {
    const user = await penggunaDenganTarget();
    const azure = pasangAzureOpenAI("http500");
    const dibuat = await (await catat({ teks_input: "nasi goreng", waktu_makan: SIANG_WIB })).json();
    expect(dibuat.estimasi_tertunda).toBe(true);

    azure.atur("berhasil");
    const id = dibuat.meal.id as string;
    const res = await estimatePost(buatRequest("POST", `/api/meals/${id}/estimate`), paramsId(id));

    expect(res.status).toBeLessThan(300);
    const baris = await prisma.nutritionEstimate.findMany({ where: { meal_log_id: id } });
    expect(baris).toHaveLength(1);
    expect(await prisma.mealLog.count({ where: { user_id: user.id } })).toBe(1);
  });
});
