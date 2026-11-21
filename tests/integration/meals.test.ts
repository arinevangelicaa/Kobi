import { describe, expect, it } from "vitest";

import { POST as estimatePost } from "@/app/api/meals/[id]/estimate/route";
import { GET as mealsGet, POST as mealsPost } from "@/app/api/meals/route";
import { GET as dailyGet } from "@/app/api/nutrition/daily/route";
import { namaModelVersi } from "@/lib/azure/openai";
import { BATAS } from "@/lib/rate-limit";

import {
  ESTIMASI_CONTOH,
  buatRequest,
  buatUser,
  get,
  masukSebagai,
  pakaiDbBersih,
  paramsId,
  pasangAzureOpenAI,
  post,
  prisma,
} from "./helpers";

pakaiDbBersih();

const TANGGAL = "2026-11-21";
const SIANG_WIB = "2026-11-21T12:00:00+07:00";

/** Pengguna login dengan target gizi tetap (protein 60, karbo 300, lemak 60, zat besi 18, 2000 kkal). */
async function penggunaDenganTarget(nama = "Pengguna Uji") {
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
const estimasiUlang = (id: string) =>
  estimatePost(buatRequest("POST", `/api/meals/${id}/estimate`), paramsId(id));

describe("catat makan: estimasi AI berhasil", () => {
  it("POST /api/meals menyimpan meal_logs dan nutrition_estimates dalam satu alur", async () => {
    const user = await penggunaDenganTarget();
    const azure = pasangAzureOpenAI();

    const res = await catat({ teks_input: "nasi telur dadar", waktu_makan: SIANG_WIB });
    expect(res.status).toBe(201);
    const badan = await res.json();

    expect(badan.success).toBe(true);
    expect(badan.estimasi_tertunda).toBe(false);
    expect(badan.rendah_keyakinan).toBe(false);
    expect(badan.items).toEqual(ESTIMASI_CONTOH.items);
    expect(badan.meal).toMatchObject({
      teks_input: "nasi telur dadar",
      vendor_id: null,
      // Pengguna tidak mengisi harga: dipakai estimasi_harga model.
      total_harga: 15000,
      waktu_makan: "2026-11-21T05:00:00.000Z",
      estimasi_tertunda: false,
      estimasi: {
        kalori_estimasi: 520,
        protein_g: 20,
        karbohidrat_g: 70,
        lemak_g: 15,
        zat_besi_mg: 3,
        tingkat_keyakinan: 0.8,
        model_versi: namaModelVersi(),
      },
    });
    expect(azure.panggilan).toBe(1);

    // Baris nyata di kedua tabel, dan user_id berasal dari sesi.
    const meal = await prisma.mealLog.findUniqueOrThrow({
      where: { id: badan.meal.id },
      include: { nutrition_estimate: true },
    });
    expect(meal.user_id).toBe(user.id);
    expect(meal.total_harga).toBe(15000);
    expect(meal.nutrition_estimate).not.toBeNull();
    expect(meal.nutrition_estimate?.kalori_estimasi).toBe(520);
    expect(Number(meal.nutrition_estimate?.protein_g)).toBe(20);
    expect(Number(meal.nutrition_estimate?.tingkat_keyakinan)).toBe(0.8);
    expect(await prisma.nutritionEstimate.count()).toBe(1);

    // Ringkasan harian ikut dihitung di respons yang sama.
    expect(badan.gizi_harian).toMatchObject({ tanggal: TANGGAL, jumlah_catatan: 1, jumlah_tanpa_estimasi: 0 });
  });

  it("total_harga dari pengguna (termasuk 0) tidak ditimpa estimasi model", async () => {
    await penggunaDenganTarget();
    pasangAzureOpenAI();

    const a = await (await catat({ teks_input: "nasi", waktu_makan: SIANG_WIB, total_harga: 12000 })).json();
    const b = await (await catat({ teks_input: "air putih", waktu_makan: SIANG_WIB, total_harga: 0 })).json();

    expect(a.meal.total_harga).toBe(12000);
    expect(b.meal.total_harga).toBe(0);
  });

  it("keyakinan rendah ditandai tetapi tetap tersimpan dan dihitung", async () => {
    await penggunaDenganTarget();
    pasangAzureOpenAI().aturEstimasi({ tingkat_keyakinan: 0.3 });

    const badan = await (await catat({ teks_input: "makanan misterius", waktu_makan: SIANG_WIB })).json();

    expect(badan.rendah_keyakinan).toBe(true);
    expect(badan.meal.estimasi.tingkat_keyakinan).toBe(0.3);
    expect(await prisma.nutritionEstimate.count()).toBe(1);
  });

  it("GET /api/nutrition/daily menghitung asupan dan gap dengan benar dari dua catatan", async () => {
    await penggunaDenganTarget();
    pasangAzureOpenAI();

    await catat({ teks_input: "nasi telur", waktu_makan: SIANG_WIB });
    await catat({ teks_input: "nasi telur lagi", waktu_makan: "2026-11-21T19:00:00+07:00" });

    const res = await dailyGet(get(`/api/nutrition/daily?tanggal=${TANGGAL}`));
    expect(res.status).toBe(200);
    const { gizi_harian: gizi } = await res.json();

    expect(gizi.tanggal).toBe(TANGGAL);
    expect(gizi.jumlah_catatan).toBe(2);
    expect(gizi.jumlah_tanpa_estimasi).toBe(0);
    expect(gizi.target).toEqual({ protein_g: 60, karbohidrat_g: 300, lemak_g: 60, zat_besi_mg: 18, kalori: 2000 });
    expect(gizi.asupan).toEqual({ protein_g: 40, karbohidrat_g: 140, lemak_g: 30, zat_besi_mg: 6, kalori: 1040 });

    const gap = Object.fromEntries(
      gizi.kesenjangan.map((g: { zat: string; kurang: number }) => [g.zat, g.kurang]),
    );
    expect(gap).toEqual({ protein_g: 20, karbohidrat_g: 160, lemak_g: 30, zat_besi_mg: 12 });
    // Terurut dari yang paling kurang terpenuhi (zat besi 6/18 = 0,33 paling kecil).
    expect(gizi.kesenjangan[0].zat).toBe("zat_besi_mg");
  });

  it("GET /api/nutrition/daily tanpa target: target null, kesenjangan kosong", async () => {
    const user = await buatUser();
    masukSebagai(user.id);

    const { gizi_harian: gizi } = await (await dailyGet(get(`/api/nutrition/daily?tanggal=${TANGGAL}`))).json();

    expect(gizi.target).toBeNull();
    expect(gizi.kesenjangan).toEqual([]);
    expect(gizi.jumlah_catatan).toBe(0);
  });

  it("GET /api/meals?tanggal= memuat catatan hari itu (terbaru dulu) dan tidak memuat hari lain", async () => {
    await penggunaDenganTarget();
    pasangAzureOpenAI();

    const pagi = await (await catat({ teks_input: "bubur", waktu_makan: "2026-11-21T07:00:00+07:00" })).json();
    const malam = await (await catat({ teks_input: "nasi goreng", waktu_makan: "2026-11-21T20:00:00+07:00" })).json();
    await catat({ teks_input: "kemarin", waktu_makan: "2026-11-20T12:00:00+07:00" });

    const res = await mealsGet(get(`/api/meals?tanggal=${TANGGAL}`));
    expect(res.status).toBe(200);
    const badan = await res.json();

    expect(badan.tanggal).toBe(TANGGAL);
    expect(badan.count).toBe(2);
    expect(badan.meals.map((m: { id: string }) => m.id)).toEqual([malam.meal.id, pagi.meal.id]);
    expect(badan.meals[0]).toMatchObject({
      teks_input: "nasi goreng",
      estimasi_tertunda: false,
      sudah_checkin: false,
      estimasi: { kalori_estimasi: 520 },
    });
  });

  it("GET /api/meals tanpa tanggal memuat catatan hari ini (WIB)", async () => {
    await penggunaDenganTarget();
    pasangAzureOpenAI();

    const dibuat = await (await catat({ teks_input: "nasi uduk" })).json();
    const badan = await (await mealsGet(get("/api/meals"))).json();

    expect(badan.meals.map((m: { id: string }) => m.id)).toContain(dibuat.meal.id);
  });

  it("401 tanpa sesi, 400 untuk input salah; tidak ada yang tersimpan dan Azure tidak dipanggil", async () => {
    const azure = pasangAzureOpenAI();

    expect((await catat({ teks_input: "nasi" })).status).toBe(401);

    await penggunaDenganTarget();
    const kosong = await catat({ teks_input: "   " });
    const tanggalSalah = await mealsGet(get("/api/meals?tanggal=2026-02-31"));
    expect(kosong.status).toBe(400);
    expect((await kosong.json()).error.code).toBe("VALIDATION_ERROR");
    expect(tanggalSalah.status).toBe(400);

    expect(await prisma.mealLog.count()).toBe(0);
    expect(azure.panggilan).toBe(0);
  });

  it("POST /api/meals memberi 429 setelah melewati batas", async () => {
    await penggunaDenganTarget();
    pasangAzureOpenAI();

    for (let i = 0; i < BATAS.catatMakan.maks; i++) {
      expect((await catat({ teks_input: `makan ${i}`, waktu_makan: SIANG_WIB })).status).toBe(201);
    }
    const ditolak = await catat({ teks_input: "satu lagi", waktu_makan: SIANG_WIB });
    expect(ditolak.status).toBe(429);
    expect((await ditolak.json()).error.code).toBe("RATE_LIMITED");
    expect(Number(ditolak.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await prisma.mealLog.count()).toBe(BATAS.catatMakan.maks);
  });
});

describe("catat makan: estimasi AI gagal, lalu diproses ulang", () => {
  it("Azure membalas 500: catatan tetap tersimpan, estimasi_tertunda, tanpa baris nutrition_estimates", async () => {
    await penggunaDenganTarget();
    const azure = pasangAzureOpenAI("http500");

    const res = await catat({ teks_input: "soto ayam", waktu_makan: SIANG_WIB, total_harga: 14000 });
    expect(res.status).toBe(201);
    const badan = await res.json();

    expect(badan.estimasi_tertunda).toBe(true);
    expect(badan.meal.estimasi).toBeNull();
    expect(badan.meal.estimasi_tertunda).toBe(true);
    expect(badan.items).toEqual([]);
    // Klien membuat satu retry untuk 5xx.
    expect(azure.panggilan).toBe(2);

    expect(await prisma.mealLog.count()).toBe(1);
    expect(await prisma.nutritionEstimate.count()).toBe(0);
    expect((await prisma.mealLog.findUniqueOrThrow({ where: { id: badan.meal.id } })).total_harga).toBe(14000);

    // Catatan tertunda dihitung sebagai "tanpa estimasi" dan belum menambah asupan.
    const { gizi_harian: gizi } = await (await dailyGet(get(`/api/nutrition/daily?tanggal=${TANGGAL}`))).json();
    expect(gizi.jumlah_catatan).toBe(1);
    expect(gizi.jumlah_tanpa_estimasi).toBe(1);
    expect(gizi.asupan.protein_g).toBe(0);

    const riwayat = await (await mealsGet(get(`/api/meals?tanggal=${TANGGAL}`))).json();
    expect(riwayat.meals[0]).toMatchObject({ estimasi_tertunda: true, estimasi: null });
  });

  it("timeout Azure juga menghasilkan catatan tertunda (tanpa retry)", async () => {
    await penggunaDenganTarget();
    const azure = pasangAzureOpenAI("timeout");

    const badan = await (await catat({ teks_input: "pecel lele", waktu_makan: SIANG_WIB })).json();

    expect(badan.estimasi_tertunda).toBe(true);
    expect(azure.panggilan).toBe(1);
    expect(await prisma.nutritionEstimate.count()).toBe(0);
  });

  it("balasan Azure di luar skema (kalori absurd) ditolak: catatan tertunda, bukan angka karangan", async () => {
    await penggunaDenganTarget();
    pasangAzureOpenAI().aturEstimasi({ kalori_estimasi: 999_999 });

    const badan = await (await catat({ teks_input: "nasi", waktu_makan: SIANG_WIB })).json();

    expect(badan.estimasi_tertunda).toBe(true);
    expect(await prisma.nutritionEstimate.count()).toBe(0);
  });

  it("POST /api/meals/[id]/estimate mengisi estimasi; panggilan kedua idempoten (sudah_ada) tanpa memanggil Azure", async () => {
    await penggunaDenganTarget();
    const azure = pasangAzureOpenAI("timeout");

    const tertunda = await (await catat({ teks_input: "gado-gado", waktu_makan: SIANG_WIB })).json();
    expect(tertunda.estimasi_tertunda).toBe(true);
    const id = tertunda.meal.id as string;

    // Azure pulih.
    azure.atur("berhasil");
    azure.reset();

    const pertama = await estimasiUlang(id);
    expect(pertama.status).toBe(200);
    const badan1 = await pertama.json();
    expect(badan1.status).toBe("diproses");
    expect(badan1.estimasi_tertunda).toBe(false);
    expect(badan1.meal.estimasi).toMatchObject({ kalori_estimasi: 520, protein_g: 20 });
    expect(badan1.items).toEqual(ESTIMASI_CONTOH.items);
    expect(azure.panggilan).toBe(1);

    // Harga kosong saat dicatat: diisi dari estimasi model.
    const baris = await prisma.mealLog.findUniqueOrThrow({ where: { id }, include: { nutrition_estimate: true } });
    expect(baris.total_harga).toBe(15000);
    expect(baris.nutrition_estimate?.kalori_estimasi).toBe(520);

    const kedua = await estimasiUlang(id);
    expect(kedua.status).toBe(200);
    const badan2 = await kedua.json();
    expect(badan2.status).toBe("sudah_ada");
    expect(badan2.items).toEqual([]);
    expect(azure.panggilan).toBe(1);
    expect(await prisma.nutritionEstimate.count()).toBe(1);

    // Asupan harian kini ikut menghitung catatan itu.
    const { gizi_harian: gizi } = await (await dailyGet(get(`/api/nutrition/daily?tanggal=${TANGGAL}`))).json();
    expect(gizi.jumlah_tanpa_estimasi).toBe(0);
    expect(gizi.asupan.protein_g).toBe(20);
  });

  it("reproses saat Azure masih gagal: tanpa_estimasi, tidak ada baris estimasi, bisa dicoba lagi", async () => {
    await penggunaDenganTarget();
    const azure = pasangAzureOpenAI("timeout");

    const { meal } = await (await catat({ teks_input: "rawon", waktu_makan: SIANG_WIB })).json();

    const gagal = await (await estimasiUlang(meal.id)).json();
    expect(gagal.status).toBe("tanpa_estimasi");
    expect(gagal.estimasi_tertunda).toBe(true);
    expect(await prisma.nutritionEstimate.count()).toBe(0);

    azure.atur("berhasil");
    expect((await (await estimasiUlang(meal.id)).json()).status).toBe("diproses");
    expect(await prisma.nutritionEstimate.count()).toBe(1);
  });

  it("dua permintaan estimasi ulang bersamaan untuk catatan yang sama: Azure dipanggil sekali, satu baris estimasi", async () => {
    await penggunaDenganTarget();
    const azure = pasangAzureOpenAI("timeout");
    const { meal } = await (await catat({ teks_input: "bakso", waktu_makan: SIANG_WIB })).json();

    azure.atur("berhasil");
    azure.reset();

    const [a, b] = await Promise.all([estimasiUlang(meal.id), estimasiUlang(meal.id)]);
    const status = [a.status, b.status].sort();

    // Kunci in-flight menjawab yang kedua 409; bila yang pertama selesai lebih
    // dulu, yang kedua melihat estimasi yang sudah ada.
    expect(status[0]).toBe(200);
    expect([200, 409]).toContain(status[1]);
    expect(azure.panggilan).toBe(1);
    expect(await prisma.nutritionEstimate.count()).toBe(1);
  });

  it("estimasi ulang dibatasi laju per pengguna (429)", async () => {
    await penggunaDenganTarget();
    pasangAzureOpenAI();
    const acak = "3f2b8c1e-9d4a-4e6b-8a1c-2d5f7e9b0a13";

    for (let i = 0; i < BATAS.estimasiUlang.maks; i++) {
      expect((await estimasiUlang(acak)).status).toBe(404);
    }
    const ditolak = await estimasiUlang(acak);
    expect(ditolak.status).toBe(429);
    expect(ditolak.headers.get("retry-after")).not.toBeNull();
  });
});
