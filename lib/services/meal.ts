/**
 * F1/F2 - pencatatan makan dan estimasi gizinya (docs/architecture.md bagian
 * 8.2 dan 15).
 *
 * Aturan utamanya: `meal_logs` disimpan LEBIH DULU, baru estimasi dipanggil.
 * Kegagalan estimasi (Azure OpenAI mati, timeout, balasan rusak) tidak pernah
 * menghilangkan catatan pengguna; catatan tanpa baris `nutrition_estimates`
 * dianggap tertunda dan bisa diproses ulang (`reprosesEstimasi`).
 *
 * Modul ini tanpa HTTP. Klien basis data bisa diinjeksi supaya bisa diuji
 * tanpa Postgres, seperti `daily-nutrition.ts`. `user_id` selalu argumen dari
 * sesi, tidak pernah dari input klien.
 */

import type { PrismaClient } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { ItemMakanan } from "@/lib/azure/openai";
import {
  dapatkanEstimasiGizi,
  type EstimasiGiziUntukDb,
} from "@/lib/services/nutrition-estimate";
import { rentangHariWIB } from "@/lib/time-wib";

export type DbMeal = Pick<PrismaClient, "mealLog">;

/**
 * Ambang keyakinan rendah (docs/architecture.md bagian 10 langkah 5, issue #10).
 * Estimasi dengan `tingkat_keyakinan` di bawah nilai ini tetap dihitung ke
 * akumulasi harian, tetapi ditandai `rendah_keyakinan` supaya UI memberi tahu
 * pengguna bahwa angkanya kurang pasti.
 */
export const AMBANG_KEYAKINAN_RENDAH = 0.5;

/** Apakah keyakinan ini tergolong rendah? Estimasi yang tidak ada bukan "rendah", melainkan tertunda. */
export function apakahKeyakinanRendah(keyakinan: number | null | undefined): boolean {
  return typeof keyakinan === "number" && keyakinan < AMBANG_KEYAKINAN_RENDAH;
}

/** Batas default catatan tertunda yang diproses ulang sekali jalan (menahan biaya AI). */
export const BATAS_REPROSES_DEFAULT = 10;

export interface EstimasiDto {
  kalori_estimasi: number;
  protein_g: number;
  karbohidrat_g: number;
  lemak_g: number;
  zat_besi_mg: number;
  tingkat_keyakinan: number;
  model_versi: string;
}

export interface CatatanMakanDto {
  id: string;
  teks_input: string;
  vendor_id: string | null;
  total_harga: number | null;
  /** ISO 8601 UTC. */
  waktu_makan: string;
  dibuat_pada: string;
  /** Null bila estimasi belum ada (tertunda). */
  estimasi: EstimasiDto | null;
  /** True bila belum punya estimasi dan perlu diproses ulang. */
  estimasi_tertunda: boolean;
  /** True bila ada estimasi dengan keyakinan di bawah `AMBANG_KEYAKINAN_RENDAH`. */
  rendah_keyakinan: boolean;
}

// Decimal Prisma dibaca lewat Number(), jadi bentuk minimal ini cukup (dan mudah ditiru di tes).
interface BarisEstimasi {
  kalori_estimasi: number;
  protein_g: unknown;
  karbohidrat_g: unknown;
  lemak_g: unknown;
  zat_besi_mg: unknown;
  tingkat_keyakinan: unknown;
  model_versi: string;
}

interface BarisMeal {
  id: string;
  teks_input: string;
  vendor_id: string | null;
  total_harga: number | null;
  waktu_makan: Date;
  dibuat_pada: Date;
  nutrition_estimate: BarisEstimasi | null;
  checkin?: { id: string } | null;
}

function keEstimasiDto(e: BarisEstimasi): EstimasiDto {
  return {
    kalori_estimasi: e.kalori_estimasi,
    protein_g: Number(e.protein_g),
    karbohidrat_g: Number(e.karbohidrat_g),
    lemak_g: Number(e.lemak_g),
    zat_besi_mg: Number(e.zat_besi_mg),
    tingkat_keyakinan: Number(e.tingkat_keyakinan),
    model_versi: e.model_versi,
  };
}

/** Memetakan baris `meal_logs` (+ `nutrition_estimate`) ke bentuk respons API. */
export function keCatatanDto(baris: BarisMeal): CatatanMakanDto {
  const estimasi = baris.nutrition_estimate ? keEstimasiDto(baris.nutrition_estimate) : null;
  return {
    id: baris.id,
    teks_input: baris.teks_input,
    vendor_id: baris.vendor_id,
    total_harga: baris.total_harga,
    waktu_makan: baris.waktu_makan.toISOString(),
    dibuat_pada: baris.dibuat_pada.toISOString(),
    estimasi,
    estimasi_tertunda: estimasi === null,
    rendah_keyakinan: estimasi !== null && apakahKeyakinanRendah(estimasi.tingkat_keyakinan),
  };
}

function kodeGalat(galat: unknown): string | undefined {
  if (typeof galat !== "object" || galat === null) return undefined;
  const { code } = galat as { code?: unknown };
  return typeof code === "string" ? code : undefined;
}

function dataEstimasiBaru(e: EstimasiGiziUntukDb) {
  return {
    kalori_estimasi: e.kalori_estimasi,
    protein_g: e.protein_g,
    karbohidrat_g: e.karbohidrat_g,
    lemak_g: e.lemak_g,
    zat_besi_mg: e.zat_besi_mg,
    tingkat_keyakinan: e.tingkat_keyakinan,
    model_versi: e.model_versi,
  };
}

/** Estimasi yang gagal dipanggil tidak boleh menjatuhkan alur: `dapatkanEstimasiGizi` tidak throw, ini jaga-jaga. */
async function panggilEstimasi(teksInput: string) {
  try {
    return await dapatkanEstimasiGizi(teksInput);
  } catch (galat) {
    console.error("Estimasi gizi melempar galat tak terduga:", galat);
    return { status: "tanpa_estimasi" as const };
  }
}

export interface InputCatatMakan {
  teks_input: string;
  waktu_makan: Date;
  vendor_id?: string;
  total_harga?: number;
}

export type HasilCatatMakan =
  | {
      status: "tersimpan";
      catatan: CatatanMakanDto;
      /** Rincian item dari model; tidak disimpan di DB, jadi hanya ada pada respons ini. */
      items: ItemMakanan[];
    }
  | {
      /** `vendor_id` tidak ada di tabel vendors (galat FK P2003). Tidak ada catatan yang tersimpan. */
      status: "vendor_tidak_valid";
    };

/**
 * Mencatat makan: simpan `meal_logs` dulu, lalu estimasi, lalu simpan
 * `nutrition_estimates`.
 *
 * `total_harga` memakai nilai pengguna (termasuk 0); bila kosong dipakai
 * `estimasi_harga` model selama bernilai positif.
 */
export async function catatMakan(
  userId: string,
  input: InputCatatMakan,
  db: DbMeal = prisma,
): Promise<HasilCatatMakan> {
  let tersimpan: { id: string };
  try {
    tersimpan = await db.mealLog.create({
      data: {
        user_id: userId,
        teks_input: input.teks_input,
        waktu_makan: input.waktu_makan,
        vendor_id: input.vendor_id ?? null,
        total_harga: input.total_harga ?? null,
      },
      select: { id: true },
    });
  } catch (galat) {
    if (kodeGalat(galat) === "P2003") return { status: "vendor_tidak_valid" };
    throw galat;
  }

  const hasil = await panggilEstimasi(input.teks_input);

  if (hasil.status === "berhasil") {
    try {
      await db.mealLog.update({
        where: { id: tersimpan.id },
        data: {
          ...(input.total_harga === undefined && hasil.estimasi_harga > 0
            ? { total_harga: hasil.estimasi_harga }
            : {}),
          nutrition_estimate: { create: dataEstimasiBaru(hasil.estimasi) },
        },
      });
    } catch (galat) {
      // Catatan sudah aman. Gagal menyimpan estimasi diperlakukan sebagai tertunda.
      console.error("Gagal menyimpan estimasi gizi, catatan ditandai tertunda:", galat);
      return await muatSebagaiTertunda(tersimpan.id, userId, db);
    }
  }

  const baris = await db.mealLog.findFirst({
    where: { id: tersimpan.id, user_id: userId },
    include: { nutrition_estimate: true },
  });
  if (!baris) throw new Error("Catatan makan yang baru disimpan tidak ditemukan.");

  return {
    status: "tersimpan",
    catatan: keCatatanDto(baris),
    items: hasil.status === "berhasil" && baris.nutrition_estimate ? hasil.items : [],
  };
}

async function muatSebagaiTertunda(id: string, userId: string, db: DbMeal): Promise<HasilCatatMakan> {
  const baris = await db.mealLog.findFirst({
    where: { id, user_id: userId },
    include: { nutrition_estimate: true },
  });
  if (!baris) throw new Error("Catatan makan yang baru disimpan tidak ditemukan.");
  return { status: "tersimpan", catatan: keCatatanDto(baris), items: [] };
}

/**
 * Riwayat makan satu hari kalender WIB (terbaru dulu). Tiap item menandai
 * `estimasi_tertunda` dan `rendah_keyakinan`, serta `sudah_checkin` untuk UI F5.
 */
export async function riwayatMakanHarian(
  userId: string,
  tanggal: string,
  db: DbMeal = prisma,
): Promise<{ tanggal: string; meals: (CatatanMakanDto & { sudah_checkin: boolean })[] }> {
  const { awal, akhir } = rentangHariWIB(tanggal);

  const baris = await db.mealLog.findMany({
    where: { user_id: userId, waktu_makan: { gte: awal, lt: akhir } },
    orderBy: { waktu_makan: "desc" },
    include: { nutrition_estimate: true, checkin: { select: { id: true } } },
  });

  return {
    tanggal,
    meals: baris.map((b) => ({ ...keCatatanDto(b), sudah_checkin: b.checkin != null })),
  };
}

export type HasilReproses =
  | {
      /** Tidak ada, atau bukan milik pengguna. Keduanya sengaja tidak dibedakan. */
      status: "tidak_ditemukan";
    }
  | {
      /** Sudah punya estimasi: tidak memanggil AI lagi (idempoten). */
      status: "sudah_ada";
      catatan: CatatanMakanDto;
    }
  | {
      status: "diproses";
      catatan: CatatanMakanDto;
      items: ItemMakanan[];
    }
  | {
      /** Estimasi gagal lagi; catatan tetap tertunda. */
      status: "tanpa_estimasi";
      catatan: CatatanMakanDto;
    };

/**
 * Memproses ulang estimasi satu catatan milik `userId`. Idempoten: bila sudah
 * punya estimasi tidak ada panggilan AI dan tidak ada tulis. Dua permintaan
 * bersamaan aman karena `meal_log_id` unik; yang kalah balapan (P2002 atau P2014) membaca
 * hasil pemenang.
 */
export async function reprosesEstimasi(
  userId: string,
  mealLogId: string,
  db: DbMeal = prisma,
): Promise<HasilReproses> {
  const awal = await db.mealLog.findFirst({
    where: { id: mealLogId, user_id: userId },
    include: { nutrition_estimate: true },
  });
  if (!awal) return { status: "tidak_ditemukan" };
  if (awal.nutrition_estimate) return { status: "sudah_ada", catatan: keCatatanDto(awal) };

  const hasil = await panggilEstimasi(awal.teks_input);
  if (hasil.status !== "berhasil") {
    return { status: "tanpa_estimasi", catatan: keCatatanDto(awal) };
  }

  try {
    await db.mealLog.update({
      where: { id: awal.id },
      data: {
        // Hanya mengisi harga bila pengguna tidak mengisinya saat mencatat.
        ...(awal.total_harga === null && hasil.estimasi_harga > 0
          ? { total_harga: hasil.estimasi_harga }
          : {}),
        nutrition_estimate: { create: dataEstimasiBaru(hasil.estimasi) },
      },
    });
  } catch (galat) {
    // Update dengan nested `create` pada relasi 1-1 yang sudah terisi gagal
    // dengan P2014 (terbukti di tes integrasi), bukan P2002 seperti `create`
    // langsung. Keduanya berarti permintaan lain sudah mengisi estimasi.
    const kode = kodeGalat(galat);
    if (kode !== "P2002" && kode !== "P2014") throw galat;
    // Permintaan lain sudah mengisi estimasi lebih dulu: pakai hasilnya.
    const terbaru = await db.mealLog.findFirst({
      where: { id: awal.id, user_id: userId },
      include: { nutrition_estimate: true },
    });
    if (!terbaru) return { status: "tidak_ditemukan" };
    // P2014 adalah kode umum pelanggaran relasi wajib. Hanya anggap "kalah
    // balapan" bila estimasi pemenang benar-benar ada; selain itu galat asli.
    if (!terbaru.nutrition_estimate) throw galat;
    return { status: "sudah_ada", catatan: keCatatanDto(terbaru) };
  }

  const baru = await db.mealLog.findFirst({
    where: { id: awal.id, user_id: userId },
    include: { nutrition_estimate: true },
  });
  if (!baru) return { status: "tidak_ditemukan" };
  return { status: "diproses", catatan: keCatatanDto(baru), items: hasil.items };
}

/** Catatan milik `userId` yang belum punya estimasi, terlama dulu. */
export async function cariCatatanTanpaEstimasi(
  userId: string,
  batas: number = BATAS_REPROSES_DEFAULT,
  db: DbMeal = prisma,
): Promise<{ id: string; teks_input: string }[]> {
  return db.mealLog.findMany({
    where: { user_id: userId, nutrition_estimate: { is: null } },
    orderBy: { waktu_makan: "asc" },
    take: batas,
    select: { id: true, teks_input: true },
  });
}

/**
 * Memproses ulang catatan tertunda milik pengguna satu per satu (berurutan
 * supaya tidak membanjiri Azure OpenAI), sebanyak-banyaknya `batas`.
 */
export async function reprosesSemuaTertunda(
  userId: string,
  batas: number = BATAS_REPROSES_DEFAULT,
  db: DbMeal = prisma,
): Promise<{ diperiksa: number; berhasil: number; masihTertunda: number }> {
  const tertunda = await cariCatatanTanpaEstimasi(userId, batas, db);
  let berhasil = 0;

  for (const { id } of tertunda) {
    const hasil = await reprosesEstimasi(userId, id, db);
    if (hasil.status === "diproses" || hasil.status === "sudah_ada") berhasil++;
  }

  return {
    diperiksa: tertunda.length,
    berhasil,
    masihTertunda: tertunda.length - berhasil,
  };
}
