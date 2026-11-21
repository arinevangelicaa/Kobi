/**
 * F5 - agregasi tren energi dan fokus mingguan (issue #49).
 *
 * Lihat docs/architecture.md bagian 8.4. Semua angka dihitung di sini, di kode.
 * Model AI (lib/azure/openai.ts) hanya menyusun kalimat dari hasil agregasi ini
 * dan tidak boleh menghitung sendiri.
 *
 * Modul ini tidak memakai Prisma saat runtime: `ambilCheckinMinggu` menerima
 * klien yang diinjeksi (hanya tipenya yang diimpor) sehingga bisa diuji tanpa
 * Postgres. Fungsi agregasinya murni.
 *
 * Satuan analisis adalah satu check-in (satu per catatan makan). Rentang
 * protein dinilai per makan, dari `nutrition_estimates.protein_g` catatan
 * makan yang di-check-in. Check-in tanpa estimasi tetap ikut rata-rata
 * mingguan tetapi tidak masuk rentang protein mana pun.
 */

import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { AgregatPola, AgregatRentangProtein } from "@/lib/azure/openai";
import { rentangHariWIB } from "@/lib/time-wib";

/** Selalu disertakan di respons tren (docs bagian 8.4 langkah 6 dan bagian 12). */
export const DISCLAIMER_TREN =
  "Ringkasan ini hanya gambaran pola dari data yang Anda catat dan bukan diagnosis medis maupun nasihat gizi profesional.";

/** Klien yang dibutuhkan, supaya mudah ditiru dalam tes. */
export type DbTren = Pick<PrismaClient, "checkin">;

/** Minimal check-in dalam seminggu agar pola dianggap bermakna. */
export const MIN_CHECKIN_MINGGUAN = 3;
/** Minimal check-in dalam satu rentang protein agar boleh dibandingkan. */
export const MIN_CHECKIN_PER_RENTANG = 2;

const SATU_HARI_MS = 24 * 60 * 60 * 1000;

interface DefinisiRentang {
  kunci: string;
  label: string;
  batas_bawah_g: number;
  batas_atas_g: number | null;
}

/**
 * Rentang protein per makan, gram. Batas bawah inklusif, batas atas eksklusif.
 * Label tidak memuat angka selain batas, supaya aman dikutip narasi.
 */
export const RENTANG_PROTEIN: readonly DefinisiRentang[] = [
  { kunci: "rendah", label: "rendah (kurang dari 10 g)", batas_bawah_g: 0, batas_atas_g: 10 },
  { kunci: "sedang", label: "sedang (10 sampai kurang dari 20 g)", batas_bawah_g: 10, batas_atas_g: 20 },
  { kunci: "tinggi", label: "tinggi (20 g atau lebih)", batas_bawah_g: 20, batas_atas_g: null },
];

/** Satu check-in beserta protein catatan makannya (null bila belum ada estimasi). */
export interface DataCheckin {
  tingkat_energi: number;
  tingkat_fokus: number;
  protein_g: number | null;
}

export interface RentangMinggu {
  /** Senin WIB, YYYY-MM-DD. */
  mulai: string;
  /** Minggu WIB, YYYY-MM-DD. */
  selesai: string;
  /** Senin 00:00 WIB (inklusif), instant UTC. */
  awal: Date;
  /** Senin berikutnya 00:00 WIB (eksklusif), instant UTC. */
  akhir: Date;
}

export type RingkasanRentangProtein = AgregatRentangProtein;

export interface TrenMingguan {
  minggu: { mulai: string; selesai: string };
  /**
   * "ok": cukup check-in untuk narasi pola. "data_kurang": keadaan kosong,
   * tampilkan ajakan mengisi check-in, bukan pola.
   */
  status: "ok" | "data_kurang";
  jumlah_checkin: number;
  /** Check-in yang catatan makannya punya estimasi, jadi masuk rentang protein. */
  jumlah_dengan_estimasi: number;
  /** Rata-rata skala 1-5, satu desimal. Null bila belum ada check-in. */
  rata_energi: number | null;
  rata_fokus: number | null;
  per_rentang_protein: RingkasanRentangProtein[];
}

/**
 * Senin-Minggu WIB yang memuat `acuan` (hari kalender WIB "YYYY-MM-DD", atau
 * instant). Kosong berarti minggu berjalan. Melempar RangeError bila tidak valid.
 */
export function rentangMingguWIB(acuan?: string | Date): RentangMinggu {
  const hari = rentangHariWIB(acuan);
  const [t, b, d] = hari.tanggal.split("-").map(Number) as [number, number, number];
  // Hari dalam seminggu dari tanggal kalender (0 = Minggu). Aman terhadap TZ
  // proses karena hanya memakai Date.UTC pada komponen tanggal WIB.
  const hariKe = new Date(Date.UTC(t, b - 1, d)).getUTCDay();
  const mundur = (hariKe + 6) % 7; // Senin = 0

  const awal = new Date(hari.awal.getTime() - mundur * SATU_HARI_MS);
  const akhir = new Date(awal.getTime() + 7 * SATU_HARI_MS);

  return {
    mulai: rentangHariWIB(awal).tanggal,
    selesai: rentangHariWIB(new Date(akhir.getTime() - 1)).tanggal,
    awal,
    akhir,
  };
}

function rataRata(nilai: number[]): number | null {
  if (nilai.length === 0) return null;
  const jumlah = nilai.reduce((a, b) => a + b, 0);
  return Math.round((jumlah / nilai.length) * 10) / 10;
}

function dalamRentang(protein: number, r: DefinisiRentang): boolean {
  return protein >= r.batas_bawah_g && (r.batas_atas_g === null || protein < r.batas_atas_g);
}

/**
 * Agregasi murni: rata-rata energi dan fokus seluruh minggu, dan per rentang
 * protein. Tidak ada pemanggilan jaringan atau basis data.
 */
export function hitungTrenMingguan(data: DataCheckin[], minggu: { mulai: string; selesai: string }): TrenMingguan {
  const denganEstimasi = data.filter((c) => c.protein_g !== null && Number.isFinite(c.protein_g));

  const perRentang: RingkasanRentangProtein[] = RENTANG_PROTEIN.map((r) => {
    const isi = denganEstimasi.filter((c) => dalamRentang(c.protein_g as number, r));
    return {
      ...r,
      jumlah_checkin: isi.length,
      rata_energi: rataRata(isi.map((c) => c.tingkat_energi)),
      rata_fokus: rataRata(isi.map((c) => c.tingkat_fokus)),
      cukup_data: isi.length >= MIN_CHECKIN_PER_RENTANG,
    };
  });

  return {
    minggu: { mulai: minggu.mulai, selesai: minggu.selesai },
    status: data.length >= MIN_CHECKIN_MINGGUAN ? "ok" : "data_kurang",
    jumlah_checkin: data.length,
    jumlah_dengan_estimasi: denganEstimasi.length,
    rata_energi: rataRata(data.map((c) => c.tingkat_energi)),
    rata_fokus: rataRata(data.map((c) => c.tingkat_fokus)),
    per_rentang_protein: perRentang,
  };
}

/** Bentuk agregat yang dikirim ke `narasiPolaDariAgregat`. */
export function keAgregatNarasi(tren: TrenMingguan): AgregatPola {
  return {
    minggu_mulai: tren.minggu.mulai,
    minggu_selesai: tren.minggu.selesai,
    jumlah_checkin: tren.jumlah_checkin,
    rata_energi: tren.rata_energi,
    rata_fokus: tren.rata_fokus,
    per_rentang_protein: tren.per_rentang_protein,
    cukup_data: tren.status === "ok",
  };
}

/**
 * Mengambil check-in milik `userId` untuk catatan makan yang waktunya jatuh di
 * `minggu` (join lewat meal_logs ke nutrition_estimates). Minggu ditentukan
 * oleh `meal_logs.waktu_makan`, bukan saat check-in diisi, supaya konsisten
 * dengan hitungan harian. `user_id` selalu dari sesi server.
 */
export async function ambilCheckinMinggu(
  db: DbTren,
  userId: string,
  minggu: RentangMinggu,
): Promise<DataCheckin[]> {
  const baris = await db.checkin.findMany({
    where: {
      user_id: userId,
      meal_log: { user_id: userId, waktu_makan: { gte: minggu.awal, lt: minggu.akhir } },
    },
    select: {
      tingkat_energi: true,
      tingkat_fokus: true,
      meal_log: { select: { nutrition_estimate: { select: { protein_g: true } } } },
    },
  });

  return baris.map((b) => ({
    tingkat_energi: b.tingkat_energi,
    tingkat_fokus: b.tingkat_fokus,
    protein_g: b.meal_log.nutrition_estimate ? Number(b.meal_log.nutrition_estimate.protein_g) : null,
  }));
}
