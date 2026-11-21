import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as checkinPost } from "@/app/api/checkins/route";
import { POST as estimatePost } from "@/app/api/meals/[id]/estimate/route";
import { GET as mealsGet, POST as mealsPost } from "@/app/api/meals/route";
import { GET as dailyGet } from "@/app/api/nutrition/daily/route";
import { GET as profileGet, PATCH as profilePatch } from "@/app/api/profile/route";
import { POST as rekomendasiPost } from "@/app/api/recommendations/route";
import { GET as schedulesGet, POST as schedulesPost } from "@/app/api/schedules/route";
import { reprosesEstimasi, type DbMeal } from "@/lib/services/meal";

import {
  buatRequest,
  buatUser,
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

afterEach(() => {
  vi.useRealTimers();
});

const UUID_TIDAK_ADA = "3f2b8c1e-9d4a-4e6b-8a1c-2d5f7e9b0a13";

const catat = (body: Record<string, unknown>) => mealsPost(post("/api/meals", body));
const estimasiUlang = (id: string) =>
  estimatePost(buatRequest("POST", `/api/meals/${id}/estimate`), paramsId(id));

async function mealTertundaMilik(userId: string, teks = "nasi rahasia") {
  return prisma.mealLog.create({
    data: { user_id: userId, teks_input: teks, waktu_makan: new Date("2026-11-21T05:00:00Z") },
  });
}

// ---------------------------------------------------------------------------
// Otorisasi (IDOR)
// ---------------------------------------------------------------------------

describe("otorisasi: pengguna B terhadap data pengguna A", () => {
  it("B tidak melihat catatan A di GET /api/meals maupun ringkasan GET /api/nutrition/daily", async () => {
    const a = await buatUser("A");
    const b = await buatUser("B");
    pasangAzureOpenAI();

    masukSebagai(a.id);
    await catat({ teks_input: "makanan pribadi A", waktu_makan: "2026-11-21T12:00:00+07:00" });

    masukSebagai(b.id);
    const riwayat = await (await mealsGet(get("/api/meals?tanggal=2026-11-21"))).json();
    const { gizi_harian: gizi } = await (await dailyGet(get("/api/nutrition/daily?tanggal=2026-11-21"))).json();

    expect(riwayat.count).toBe(0);
    expect(gizi.jumlah_catatan).toBe(0);
    expect(gizi.asupan.protein_g).toBe(0);
  });

  it("B tidak bisa mengestimasi ulang catatan A: 404 (sama dengan tidak ada), tanpa panggilan Azure dan tanpa estimasi", async () => {
    const a = await buatUser("A");
    const b = await buatUser("B");
    const meal = await mealTertundaMilik(a.id);
    const azure = pasangAzureOpenAI();

    masukSebagai(b.id);
    const orangLain = await estimasiUlang(meal.id);
    const tidakAda = await estimasiUlang(UUID_TIDAK_ADA);
    const bukanUuid = await estimasiUlang("bukan-uuid");

    for (const res of [orangLain, tidakAda, bukanUuid]) {
      expect(res.status).toBe(404);
      expect((await res.json()).error.code).toBe("NOT_FOUND");
    }
    expect(azure.panggilan).toBe(0);
    expect(await prisma.nutritionEstimate.count()).toBe(0);

    // Pemilik yang sah tetap bisa.
    masukSebagai(a.id);
    expect((await (await estimasiUlang(meal.id)).json()).status).toBe("diproses");
  });

  it("B tidak bisa check-in pada catatan A: 404 dan tidak ada check-in tersimpan", async () => {
    const a = await buatUser("A");
    const b = await buatUser("B");
    const meal = await mealTertundaMilik(a.id);

    masukSebagai(b.id);
    const res = await checkinPost(
      post("/api/checkins", { meal_log_id: meal.id, tingkat_energi: 3, tingkat_fokus: 3 }),
    );

    expect(res.status).toBe(404);
    expect(await prisma.checkin.count()).toBe(0);
  });

  it("user_id/id di body tidak bisa menimpa sesi: catatan, rekomendasi, dan profil tetap milik sesi", async () => {
    const a = await buatUser("A");
    const b = await buatUser("B");
    pasangAzureOpenAI();
    masukSebagai(b.id);

    // meals: kunci tak dikenal dibuang oleh skema, user_id tetap dari sesi.
    const res = await catat({ teks_input: "nasi", user_id: a.id, waktu_makan: "2026-11-21T12:00:00+07:00" });
    expect(res.status).toBe(201);
    const { meal } = await res.json();
    expect((await prisma.mealLog.findUniqueOrThrow({ where: { id: meal.id } })).user_id).toBe(b.id);

    // profil: skema strict menolak id/email, dan PATCH hanya menyentuh pengguna sesi.
    const tolak = await profilePatch(patch("/api/profile", { id: a.id, nama: "Diambil alih" }));
    expect(tolak.status).toBe(400);
    await profilePatch(patch("/api/profile", { nama: "Nama B" }));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: a.id } })).nama).toBe("A");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: b.id } })).nama).toBe("Nama B");

    // rekomendasi: riwayat disimpan atas nama sesi.
    const vendor = await prisma.vendor.create({
      data: { nama_warung: "Warung", latitude: -6.2, longitude: 106.8166 },
    });
    await prisma.menuItem.create({ data: { vendor_id: vendor.id, nama_menu: "Nasi", estimasi_harga: 10000 } });
    const rek = await rekomendasiPost(
      post("/api/recommendations", {
        latitude: -6.2,
        longitude: 106.8166,
        batas_anggaran: 20000,
        sela_waktu_menit: 120,
        user_id: a.id,
      }),
    );
    expect(rek.status).toBe(200);
    expect(await prisma.recommendation.count({ where: { user_id: a.id } })).toBe(0);
    expect(await prisma.recommendation.count({ where: { user_id: b.id } })).toBe(1);
  });

  it("endpoint yang dilindungi menjawab 401 tanpa sesi dan tidak menulis apa pun", async () => {
    const azure = pasangAzureOpenAI();
    masukSebagai(null);

    const hasil = [
      await profileGet(),
      await profilePatch(patch("/api/profile", { nama: "X" })),
      await schedulesGet(),
      await schedulesPost(post("/api/schedules", { mata_kuliah: "X", hari: 1, jam_mulai: "08:00", jam_selesai: "09:00" })),
      await catat({ teks_input: "nasi" }),
      await mealsGet(get("/api/meals")),
      await dailyGet(get("/api/nutrition/daily")),
      await estimasiUlang(UUID_TIDAK_ADA),
      await checkinPost(post("/api/checkins", { meal_log_id: UUID_TIDAK_ADA, tingkat_energi: 3, tingkat_fokus: 3 })),
    ];

    for (const res of hasil) expect(res.status).toBe(401);
    expect(azure.panggilan).toBe(0);
    expect(await prisma.mealLog.count()).toBe(0);
    expect(await prisma.classSchedule.count()).toBe(0);
  });

  it("teks mengandung SQL tersimpan sebagai data biasa (query berparameter)", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    pasangAzureOpenAI();

    const teks = "nasi'); DROP TABLE users; --";
    const res = await catat({ teks_input: teks, waktu_makan: "2026-11-21T12:00:00+07:00" });

    expect(res.status).toBe(201);
    expect((await prisma.mealLog.findFirstOrThrow()).teks_input).toBe(teks);
    expect(await prisma.user.count()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Integritas referensial
// ---------------------------------------------------------------------------

describe("integritas: vendor_id", () => {
  it("vendor_id yang tidak ada: 400 VENDOR_NOT_FOUND, tidak ada catatan, Azure tidak dipanggil", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    const azure = pasangAzureOpenAI();

    const res = await catat({ teks_input: "nasi", vendor_id: UUID_TIDAK_ADA });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VENDOR_NOT_FOUND");
    expect(await prisma.mealLog.count()).toBe(0);
    expect(azure.panggilan).toBe(0);
  });

  it("asumsi tiruan terbukti: FK ke vendor yang tidak ada di Postgres sungguhan memberi galat berkode P2003", async () => {
    const user = await buatUser();

    // Kode yang dibaca `kodeGalat()` di lib/services/meal.ts.
    await expect(
      prisma.mealLog.create({
        data: { user_id: user.id, teks_input: "x", waktu_makan: new Date(), vendor_id: UUID_TIDAK_ADA },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("vendor_id valid tersimpan; vendor dihapus: meal_logs.vendor_id jadi null, catatan tetap ada", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    pasangAzureOpenAI();
    const vendor = await prisma.vendor.create({ data: { nama_warung: "Warung Fana" } });

    const { meal } = await (await catat({ teks_input: "nasi", vendor_id: vendor.id })).json();
    expect(meal.vendor_id).toBe(vendor.id);

    await prisma.vendor.delete({ where: { id: vendor.id } });

    const baris = await prisma.mealLog.findUniqueOrThrow({ where: { id: meal.id } });
    expect(baris.vendor_id).toBeNull();
  });
});

describe("integritas: batas hari WIB", () => {
  // 00:30 WIB tanggal 21 = 17:30 UTC tanggal 20. Kode yang memakai hari UTC
  // atau hari zona waktu proses (tes ini berjalan di TZ non-WIB) akan salah.
  it("waktu_makan 00:30 WIB masuk hari WIB yang benar di GET /api/meals dan GET /api/nutrition/daily", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    pasangAzureOpenAI();
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

    const res = await catat({ teks_input: "mi instan tengah malam", waktu_makan: "2026-11-21T00:30:00+07:00" });
    expect(res.status).toBe(201);
    const badan = await res.json();

    expect(badan.meal.waktu_makan).toBe("2026-11-20T17:30:00.000Z");
    expect(badan.gizi_harian.tanggal).toBe("2026-11-21");
    expect(badan.gizi_harian.jumlah_catatan).toBe(1);

    const hari21 = await (await mealsGet(get("/api/meals?tanggal=2026-11-21"))).json();
    const hari20 = await (await mealsGet(get("/api/meals?tanggal=2026-11-20"))).json();
    expect(hari21.count).toBe(1);
    expect(hari20.count).toBe(0);

    const gizi21 = (await (await dailyGet(get("/api/nutrition/daily?tanggal=2026-11-21"))).json()).gizi_harian;
    const gizi20 = (await (await dailyGet(get("/api/nutrition/daily?tanggal=2026-11-20"))).json()).gizi_harian;
    expect(gizi21.jumlah_catatan).toBe(1);
    expect(gizi21.asupan.protein_g).toBe(20);
    expect(gizi20.jumlah_catatan).toBe(0);
    expect(gizi20.asupan.protein_g).toBe(0);
  });

  it("tepat tengah malam WIB: 00:00:00 masuk hari baru, 23:59:59.999 hari sebelumnya", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    pasangAzureOpenAI();

    await catat({ teks_input: "awal hari", waktu_makan: "2026-11-21T00:00:00.000+07:00" });
    await catat({ teks_input: "akhir hari", waktu_makan: "2026-11-20T23:59:59.999+07:00" });

    const hari21 = await (await mealsGet(get("/api/meals?tanggal=2026-11-21"))).json();
    const hari20 = await (await mealsGet(get("/api/meals?tanggal=2026-11-20"))).json();
    expect(hari21.meals.map((m: { teks_input: string }) => m.teks_input)).toEqual(["awal hari"]);
    expect(hari20.meals.map((m: { teks_input: string }) => m.teks_input)).toEqual(["akhir hari"]);
  });

  it("waktu_makan dengan offset lain (UTC) dipetakan ke hari WIB, bukan hari UTC", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    pasangAzureOpenAI();

    // 20:00 UTC tanggal 20 = 03:00 WIB tanggal 21.
    await catat({ teks_input: "sahur", waktu_makan: "2026-11-20T20:00:00Z" });

    expect((await (await mealsGet(get("/api/meals?tanggal=2026-11-21"))).json()).count).toBe(1);
    expect((await (await mealsGet(get("/api/meals?tanggal=2026-11-20"))).json()).count).toBe(0);
  });

  it("tanpa parameter tanggal, 'hari ini' adalah hari WIB (01:00 WIB = 18:00 UTC hari sebelumnya)", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    await prisma.mealLog.create({
      data: { user_id: user.id, teks_input: "dini hari", waktu_makan: new Date("2026-11-20T17:30:00Z") },
    });

    // Hanya Date yang dipalsukan; timer dan I/O driver pg tetap nyata.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T18:00:00Z"));

    const riwayat = await (await mealsGet(get("/api/meals"))).json();
    const { gizi_harian: gizi } = await (await dailyGet(get("/api/nutrition/daily"))).json();

    expect(riwayat.tanggal).toBe("2026-11-21");
    expect(riwayat.count).toBe(1);
    expect(gizi.tanggal).toBe("2026-11-21");
    expect(gizi.jumlah_catatan).toBe(1);
  });
});

describe("integritas: penulisan bersarang dan cascade", () => {
  const dataEstimasi = {
    kalori_estimasi: 500,
    protein_g: 20,
    karbohidrat_g: 60,
    lemak_g: 10,
    zat_besi_mg: 3,
    tingkat_keyakinan: 0.7,
    model_versi: "uji",
  };

  it("satu update dengan nested nutrition_estimate.create menulis dua tabel", async () => {
    const user = await buatUser();
    const meal = await mealTertundaMilik(user.id);

    await prisma.mealLog.update({
      where: { id: meal.id },
      data: { total_harga: 12000, nutrition_estimate: { create: dataEstimasi } },
    });

    expect((await prisma.mealLog.findUniqueOrThrow({ where: { id: meal.id } })).total_harga).toBe(12000);
    const estimasi = await prisma.nutritionEstimate.findMany();
    expect(estimasi).toHaveLength(1);
    expect(estimasi[0]).toMatchObject({ meal_log_id: meal.id, kalori_estimasi: 500 });
  });

  it("nested create kedua untuk meal_log yang sama gagal dan update total_harga ikut dibatalkan (atomik)", async () => {
    const user = await buatUser();
    const meal = await mealTertundaMilik(user.id);
    await prisma.mealLog.update({
      where: { id: meal.id },
      data: { total_harga: 12000, nutrition_estimate: { create: dataEstimasi } },
    });

    // TEMUAN: kode galatnya P2014 (pelanggaran relasi 1-1 yang dideteksi Prisma),
    // BUKAN P2002 seperti yang diasumsikan `reprosesEstimasi` dan tes unitnya.
    // Bahkan untuk update bersamaan yang sungguh balapan, yang kalah mendapat
    // P2014 (lihat tes BUG di bawah). P2002 hanya muncul untuk create langsung.
    await expect(
      prisma.mealLog.update({
        where: { id: meal.id },
        data: { total_harga: 99999, nutrition_estimate: { create: dataEstimasi } },
      }),
    ).rejects.toMatchObject({ code: "P2014" });

    expect((await prisma.mealLog.findUniqueOrThrow({ where: { id: meal.id } })).total_harga).toBe(12000);
    expect(await prisma.nutritionEstimate.count()).toBe(1);
  });

  it("create langsung nutrition_estimates kedua untuk meal_log yang sama memberi P2002 (unique meal_log_id)", async () => {
    const user = await buatUser();
    const meal = await mealTertundaMilik(user.id);
    await prisma.nutritionEstimate.create({ data: { meal_log_id: meal.id, ...dataEstimasi } });

    await expect(
      prisma.nutritionEstimate.create({ data: { meal_log_id: meal.id, ...dataEstimasi } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  // BUG: `reprosesEstimasi` (lib/services/meal.ts) menangani kalah balapan
  // dengan `kodeGalat(galat) !== "P2002"` -> lempar ulang. Tetapi update dengan
  // nested `nutrition_estimate: { create }` pada relasi 1-1 yang sudah terisi
  // gagal dengan P2014, bukan P2002 (dibuktikan tes di atas; dalam 3 update
  // bersamaan 2 yang kalah selalu P2014). Akibatnya bila permintaan lain
  // (instance App Service lain, karena kunci in-flight hanya per proses)
  // sudah menyimpan estimasi setelah pembacaan awal, handler melempar dan
  // klien menerima 500. Seharusnya status "sudah_ada" dengan hasil pemenang.
  // Perbaikan: tangani juga P2014 (atau pakai `nutritionEstimate.create` langsung
  // yang memberi P2002).
  it.fails("BUG: reprosesEstimasi yang kalah balapan (galat P2014) seharusnya sudah_ada, bukan melempar", async () => {
    const user = await buatUser();
    const meal = await mealTertundaMilik(user.id);
    pasangAzureOpenAI();

    // Cuplikan basi: dibaca sebelum "instance lain" menyimpan estimasi.
    const basi = await prisma.mealLog.findFirstOrThrow({
      where: { id: meal.id, user_id: user.id },
      include: { nutrition_estimate: true },
    });
    await prisma.mealLog.update({
      where: { id: meal.id },
      data: { nutrition_estimate: { create: dataEstimasi } },
    });

    let basiSudahDipakai = false;
    const db = {
      mealLog: {
        findFirst: async (args: Parameters<typeof prisma.mealLog.findFirst>[0]) => {
          if (!basiSudahDipakai) {
            basiSudahDipakai = true;
            return basi;
          }
          return prisma.mealLog.findFirst(args);
        },
        update: (args: Parameters<typeof prisma.mealLog.update>[0]) => prisma.mealLog.update(args),
      },
    } as unknown as DbMeal;

    const hasil = await reprosesEstimasi(user.id, meal.id, db);

    expect(hasil.status).toBe("sudah_ada");
    expect(await prisma.nutritionEstimate.count()).toBe(1);
  });

  it("nested create yang melanggar tipe kolom (keyakinan 10 di numeric(3,2)) membatalkan seluruh update", async () => {
    const user = await buatUser();
    const meal = await mealTertundaMilik(user.id);

    await expect(
      prisma.mealLog.update({
        where: { id: meal.id },
        data: { total_harga: 7777, nutrition_estimate: { create: { ...dataEstimasi, tingkat_keyakinan: 10 } } },
      }),
    ).rejects.toBeDefined();

    expect((await prisma.mealLog.findUniqueOrThrow({ where: { id: meal.id } })).total_harga).toBeNull();
    expect(await prisma.nutritionEstimate.count()).toBe(0);
  });

  it("menghapus pengguna membersihkan semua data turunan, tetapi tidak vendor/menu", async () => {
    const user = await buatUser();
    const lain = await buatUser("Lain");
    const vendor = await prisma.vendor.create({ data: { nama_warung: "Warung Abadi" } });
    const menu = await prisma.menuItem.create({
      data: { vendor_id: vendor.id, nama_menu: "Nasi", estimasi_harga: 10000 },
    });

    const meal = await mealTertundaMilik(user.id);
    await prisma.mealLog.update({ where: { id: meal.id }, data: { nutrition_estimate: { create: dataEstimasi } } });
    await prisma.checkin.create({
      data: { user_id: user.id, meal_log_id: meal.id, tingkat_energi: 3, tingkat_fokus: 3 },
    });
    await prisma.classSchedule.create({
      data: {
        user_id: user.id,
        mata_kuliah: "Kalkulus",
        hari: 1,
        jam_mulai: new Date("1970-01-01T08:00:00Z"),
        jam_selesai: new Date("1970-01-01T09:00:00Z"),
      },
    });
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
    await prisma.recommendation.create({
      data: {
        user_id: user.id,
        menu_item_id: menu.id,
        vendor_id: vendor.id,
        gizi_disasar: "protein",
        batas_anggaran: 20000,
        sela_waktu_menit: 60,
      },
    });
    // Data pengguna lain harus selamat.
    await mealTertundaMilik(lain.id, "milik lain");

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.mealLog.count({ where: { user_id: user.id } })).toBe(0);
    expect(await prisma.nutritionEstimate.count()).toBe(0);
    expect(await prisma.checkin.count()).toBe(0);
    expect(await prisma.classSchedule.count()).toBe(0);
    expect(await prisma.nutritionTarget.count()).toBe(0);
    expect(await prisma.recommendation.count()).toBe(0);

    expect(await prisma.mealLog.count({ where: { user_id: lain.id } })).toBe(1);
    expect(await prisma.vendor.count()).toBe(1);
    expect(await prisma.menuItem.count()).toBe(1);
  });

  it("menghapus meal_log menghapus estimasi dan check-in-nya; menghapus vendor menghapus menu dan rekomendasinya", async () => {
    const user = await buatUser();
    const vendor = await prisma.vendor.create({ data: { nama_warung: "Warung" } });
    const menu = await prisma.menuItem.create({
      data: { vendor_id: vendor.id, nama_menu: "Nasi", estimasi_harga: 10000 },
    });
    await prisma.recommendation.create({
      data: {
        user_id: user.id,
        menu_item_id: menu.id,
        vendor_id: vendor.id,
        gizi_disasar: "protein",
        batas_anggaran: 20000,
        sela_waktu_menit: 60,
      },
    });
    const meal = await mealTertundaMilik(user.id);
    await prisma.mealLog.update({ where: { id: meal.id }, data: { nutrition_estimate: { create: dataEstimasi } } });
    await prisma.checkin.create({
      data: { user_id: user.id, meal_log_id: meal.id, tingkat_energi: 3, tingkat_fokus: 3 },
    });

    await prisma.mealLog.delete({ where: { id: meal.id } });
    expect(await prisma.nutritionEstimate.count()).toBe(0);
    expect(await prisma.checkin.count()).toBe(0);

    await prisma.vendor.delete({ where: { id: vendor.id } });
    expect(await prisma.menuItem.count()).toBe(0);
    expect(await prisma.recommendation.count()).toBe(0);
    expect(await prisma.user.count()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Ketahanan input (temuan bug)
// ---------------------------------------------------------------------------

describe("ketahanan input: galat DB tidak boleh bocor sebagai 500/lemparan", () => {
  // BUG: `tanggal_lahir` hanya divalidasi dengan regex YYYY-MM-DD. "2003-02-31"
  // lolos Zod, lalu `new Date("2003-02-31")` (V8) menggulirkannya diam-diam ke
  // 2003-03-03: PATCH menjawab 200 dan menyimpan tanggal lahir yang SALAH
  // (dan target gizi dihitung dari usia yang salah). Seharusnya 400
  // VALIDATION_ERROR, seperti `apakahTanggalValid` di lib/validation/meal.ts
  // untuk parameter ?tanggal=.
  it.fails("BUG: PATCH /api/profile dengan tanggal_lahir 2003-02-31 seharusnya 400, bukan 200 dengan tanggal bergeser", async () => {
    const user = await buatUser();
    masukSebagai(user.id);

    const res = await profilePatch(patch("/api/profile", { tanggal_lahir: "2003-02-31" }));

    expect(res.status).toBe(400);
  });

  // BUG: sama dengan di atas, tetapi "2003-13-01" menghasilkan Invalid Date.
  // Prisma melempar galat validasi dan karena /api/profile tidak dibungkus
  // `denganPenangananGalat`, handler melempar (500 mentah, pesan galat internal
  // bisa bocor). Seharusnya 400 VALIDATION_ERROR.
  it.fails("BUG: PATCH /api/profile dengan tanggal_lahir 2003-13-01 seharusnya 400, bukan melempar galat", async () => {
    const user = await buatUser();
    masukSebagai(user.id);

    const res = await profilePatch(patch("/api/profile", { tanggal_lahir: "2003-13-01" }));

    expect(res.status).toBe(400);
  });

  // BUG: `preferensi_anggaran` hanya dibatasi min(0), tanpa batas atas, padahal
  // kolomnya INT4. Nilai 3.000.000.000 lolos Zod lalu ditolak Postgres
  // (out of range) sebagai galat yang tidak ditangkap -> 500. Seharusnya 400
  // dengan pesan batas wajar (mis. maks 100.000.000 seperti `total_harga`).
  it.fails("BUG: PATCH /api/profile dengan preferensi_anggaran di luar rentang INT4 seharusnya 400", async () => {
    const user = await buatUser();
    masukSebagai(user.id);

    const res = await profilePatch(patch("/api/profile", { preferensi_anggaran: 3_000_000_000 }));

    expect(res.status).toBe(400);
  });

  // BUG: teks dengan karakter NUL (\u0000) lolos validasi `teks_input` (hanya
  // trim/min/max) tetapi Postgres menolak NUL di kolom text. Di
  // `catatMakan` galat itu bukan P2003, jadi dilempar ulang dan klien menerima
  // 500 INTERNAL_ERROR. Seharusnya 400 VALIDATION_ERROR (atau NUL dibuang).
  it.fails("BUG: POST /api/meals dengan teks_input berisi NUL seharusnya 400, bukan 500", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    pasangAzureOpenAI();
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await catat({ teks_input: "nasi\u0000goreng", waktu_makan: "2026-11-21T12:00:00+07:00" });

    expect(res.status).toBe(400);
  });
});
