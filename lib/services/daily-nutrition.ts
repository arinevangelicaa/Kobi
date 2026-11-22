/**
 * F2 - ringkasan gizi satu hari: target, akumulasi, dan kesenjangan.
 *
 * Lihat docs/architecture.md bagian 8.2 dan 10. Dipakai bersama oleh
 * GET /api/nutrition/daily, /beranda, dan rekomendasi supaya hitungannya satu.
 * Perhitungan murninya ada di nutrition-gap.ts; modul ini hanya mengambil data.
 * Klien basis data bisa diinjeksi supaya bisa diuji tanpa Postgres.
 */

import type { PrismaClient } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { rentangHariWIB } from "@/lib/time-wib";
import { apakahKeyakinanRendah } from "@/lib/services/meal";
import {
  hitungKesenjangan,
  jumlahkanAsupan,
  type AsupanHarian,
  type EstimasiGizi,
  type Kesenjangan,
  type TargetHarian,
} from "@/lib/services/nutrition-gap";

export type DbGizi = Pick<PrismaClient, "nutritionTarget" | "mealLog">;

export interface GiziHarian {
  /** Hari kalender WIB, YYYY-MM-DD. */
  tanggal: string;
  /** Null bila pengguna belum punya baris nutrition_targets. */
  target: TargetHarian | null;
  asupan: AsupanHarian;
  /** Kosong bila `target` null. Diurutkan dari yang paling kurang. */
  kesenjangan: Kesenjangan[];
  jumlah_catatan: number;
  /** Catatan yang belum punya estimasi (Azure OpenAI gagal), belum ikut dihitung. */
  jumlah_tanpa_estimasi: number;
  /** Catatan berestimasi dengan keyakinan rendah, tetap ikut dihitung. */
  jumlah_keyakinan_rendah: number;
}

/**
 * Mengambil ringkasan gizi satu hari kalender WIB milik `userId`.
 *
 * Target yang dipakai adalah yang berlaku pada hari itu (`berlaku_sejak` paling
 * akhir yang tidak melewati hari itu), supaya kesenjangan masa lalu tetap
 * dihitung dengan target saat itu (docs bagian 8.1 langkah 5). Bila semua target
 * dibuat setelah hari itu, target tertua dipakai daripada tanpa target.
 */
export async function dapatkanGiziHarian(
  userId: string,
  acuan?: string | Date,
  db: DbGizi = prisma,
): Promise<GiziHarian> {
  const { tanggal, awal, akhir } = rentangHariWIB(acuan);
  const batasBerlaku = new Date(`${tanggal}T00:00:00.000Z`);

  const [targetBerlaku, catatan] = await Promise.all([
    db.nutritionTarget.findFirst({
      where: { user_id: userId, berlaku_sejak: { lte: batasBerlaku } },
      orderBy: { berlaku_sejak: "desc" },
    }),
    db.mealLog.findMany({
      where: { user_id: userId, waktu_makan: { gte: awal, lt: akhir } },
      include: { nutrition_estimate: true },
    }),
  ]);

  const targetDb =
    targetBerlaku ??
    (await db.nutritionTarget.findFirst({
      where: { user_id: userId },
      orderBy: { berlaku_sejak: "asc" },
    }));

  const estimasi: EstimasiGizi[] = [];
  let jumlahKeyakinanRendah = 0;
  for (const meal of catatan) {
    const e = meal.nutrition_estimate;
    if (!e) continue;
    if (apakahKeyakinanRendah(Number(e.tingkat_keyakinan))) {
      jumlahKeyakinanRendah++;
    }
    estimasi.push({
      protein_g: Number(e.protein_g),
      karbohidrat_g: Number(e.karbohidrat_g),
      lemak_g: Number(e.lemak_g),
      zat_besi_mg: Number(e.zat_besi_mg),
      kalori_estimasi: e.kalori_estimasi,
    });
  }

  const asupan = jumlahkanAsupan(estimasi);
  const target: TargetHarian | null = targetDb
    ? {
        protein_g: Number(targetDb.protein_target_g),
        karbohidrat_g: Number(targetDb.karbohidrat_target_g),
        lemak_g: Number(targetDb.lemak_target_g),
        zat_besi_mg: Number(targetDb.zat_besi_target_mg),
        kalori: targetDb.kalori_target,
      }
    : null;

  return {
    tanggal,
    target,
    asupan,
    kesenjangan: target ? hitungKesenjangan(target, asupan) : [],
    jumlah_catatan: catatan.length,
    jumlah_tanpa_estimasi: catatan.length - estimasi.length,
    jumlah_keyakinan_rendah: jumlahKeyakinanRendah,
  };
}
