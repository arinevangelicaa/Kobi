/**
 * Pembatas laju untuk endpoint yang memanggil layanan AI
 * (docs/architecture.md bagian 12: dibatasi per pengguna untuk membendung
 * biaya dan penyalahgunaan).
 *
 * Algoritma: jendela geser (sliding window log) per kunci `(bucket, user_id)`.
 * Tiap kunci menyimpan waktu permintaan yang lolos dalam jendela terakhir;
 * permintaan yang ditolak tidak dihitung, jadi klien yang terus mencoba tidak
 * memperpanjang masa tunggunya sendiri.
 *
 * KETERBATASAN: penyimpanan ada di memori proses. Keadaan TIDAK dibagi antar
 * instance App Service dan hilang saat proses restart, sehingga batas efektif
 * berlaku per instance (N instance = hingga N kali batas). Ini dapat diterima
 * karena MVP berjalan di satu instance (docs/architecture.md bagian 17);
 * bila nanti autoscale, pindahkan penyimpanan ke Redis/Postgres dengan API
 * yang sama.
 *
 * Berkas ini juga memuat kunci in-flight untuk estimasi ulang, yang punya
 * keterbatasan instance yang sama.
 */

import type { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api";

export type KonfigBatas = {
  /** Jumlah maksimum permintaan yang lolos dalam satu jendela. */
  maks: number;
  /** Panjang jendela geser, dalam milidetik. */
  jendelaMs: number;
};

export type HasilBatas = { diizinkan: true } | { diizinkan: false; ulangiDalamDetik: number };

// Batas per bucket. Angka sengaja longgar untuk pemakaian wajar dan hanya
// memotong pemakaian otomatis atau berulang yang menguras kuota Azure.
export const BATAS = {
  // Mencatat makan: mahasiswa mencatat 3-6 kali sehari; 30 per jam mencakup
  // mencatat beberapa makanan sekaligus dan salah ketik yang diulang.
  catatMakan: { maks: 30, jendelaMs: 60 * 60 * 1000 },
  // Estimasi ulang hanya perlu setelah Azure gagal. Lebih ketat dari
  // mencatat: 10 per 10 menit cukup untuk mencoba beberapa catatan tertunda
  // tanpa membuka jalan memanggil AI berulang untuk catatan yang sama.
  estimasiUlang: { maks: 10, jendelaMs: 10 * 60 * 1000 },
  // Tren mingguan: pengguna berpindah antarminggu di UI; 10 per menit cukup
  // untuk menelusuri minggu-minggu lama, tetapi menahan polling cepat.
  trenMingguan: { maks: 10, jendelaMs: 60 * 1000 },
} as const satisfies Record<string, KonfigBatas>;

export type NamaBucket = keyof typeof BATAS;

type Entri = {
  jendelaMs: number;
  /** Waktu permintaan yang lolos, urut naik. */
  waktu: number[];
};

const penyimpanan = new Map<string, Entri>();

// Pembersihan: sapu seluruh Map paling cepat sekali per interval, ditambah
// batas keras jumlah kunci supaya Map tidak membengkak tanpa batas.
export const INTERVAL_SAPU_MS = 60 * 1000;
export const MAKS_KUNCI = 10_000;
let sapuTerakhir = 0;

function buatKunci(bucket: string, userId: string) {
  return `${bucket}\u0000${userId}`;
}

/** Hapus waktu yang sudah keluar dari jendela. */
function pangkas(entri: Entri, sekarang: number) {
  const batasLama = sekarang - entri.jendelaMs;
  let i = 0;
  while (i < entri.waktu.length && (entri.waktu[i] as number) <= batasLama) i++;
  if (i > 0) entri.waktu.splice(0, i);
}

function sapu(sekarang: number) {
  // Waktu mundur (mis. jam sistem dikoreksi): mulai lagi dari sekarang.
  if (sekarang < sapuTerakhir) sapuTerakhir = sekarang;

  // Sapuan penuh paling cepat sekali per interval: buang kunci yang
  // jendelanya sudah lewat.
  if (sekarang - sapuTerakhir >= INTERVAL_SAPU_MS) {
    sapuTerakhir = sekarang;
    for (const [kunci, entri] of penyimpanan) {
      pangkas(entri, sekarang);
      if (entri.waktu.length === 0) penyimpanan.delete(kunci);
    }
  }

  // Batas keras: bila masih berlebih, buang kunci tertua (Map mengiterasi
  // menurut urutan penyisipan). Murah karena hanya menyentuh kelebihannya.
  let kelebihan = penyimpanan.size - MAKS_KUNCI;
  if (kelebihan > 0) {
    for (const kunci of penyimpanan.keys()) {
      if (kelebihan-- <= 0) break;
      penyimpanan.delete(kunci);
    }
  }
}

/**
 * Memeriksa dan, bila lolos, mencatat satu permintaan.
 * `sekarang` dapat disuntikkan supaya mudah dites.
 */
export function periksaBatas(
  bucket: string,
  userId: string,
  { maks, jendelaMs }: KonfigBatas,
  sekarang: number = Date.now(),
): HasilBatas {
  sapu(sekarang);

  const kunci = buatKunci(bucket, userId);
  let entri = penyimpanan.get(kunci);
  if (!entri) {
    entri = { jendelaMs, waktu: [] };
  }
  entri.jendelaMs = jendelaMs;
  pangkas(entri, sekarang);

  if (entri.waktu.length >= maks) {
    // Slot pertama bebas saat permintaan tertua keluar dari jendela.
    const bebasPada = (entri.waktu[entri.waktu.length - maks] as number) + jendelaMs;
    const ulangiDalamDetik = Math.max(1, Math.ceil((bebasPada - sekarang) / 1000));
    if (!penyimpanan.has(kunci)) penyimpanan.set(kunci, entri);
    return { diizinkan: false, ulangiDalamDetik };
  }

  entri.waktu.push(sekarang);
  penyimpanan.set(kunci, entri);
  return { diizinkan: true };
}

/**
 * Pemakaian di Route Handler, setelah `requireUser` dan sebelum memanggil AI:
 *
 *   const ditolak = batasiLaju("catatMakan", userId);
 *   if (ditolak) return ditolak;
 *
 * Mengembalikan respons 429 (`RATE_LIMITED`) berikut header `Retry-After`
 * (detik) bila ditolak, `null` bila lolos.
 */
export function batasiLaju(bucket: NamaBucket, userId: string): NextResponse | null {
  const hasil = periksaBatas(bucket, userId, BATAS[bucket]);
  if (hasil.diizinkan) return null;

  const respons = errorResponse(
    429,
    "RATE_LIMITED",
    `Terlalu banyak permintaan. Coba lagi dalam ${hasil.ulangiDalamDetik} detik.`,
  );
  respons.headers.set("Retry-After", String(hasil.ulangiDalamDetik));
  return respons;
}

// ---------------------------------------------------------------------------
// Kunci in-flight untuk estimasi ulang: dua permintaan bersamaan untuk catatan
// yang sama tidak boleh sama-sama memanggil Azure.
// ---------------------------------------------------------------------------

const sedangDiproses = new Set<string>();

/**
 * Mengambil kunci proses untuk `(userId, mealId)`. Mengembalikan fungsi
 * pelepas bila berhasil, `null` bila catatan itu sedang diproses. Pelepas
 * idempoten; panggil di `finally`.
 */
export function ambilKunciEstimasi(userId: string, mealId: string): (() => void) | null {
  const kunci = buatKunci(userId, mealId);
  if (sedangDiproses.has(kunci)) return null;

  sedangDiproses.add(kunci);
  let terlepas = false;
  return () => {
    if (terlepas) return;
    terlepas = true;
    sedangDiproses.delete(kunci);
  };
}

/** Hanya untuk tes: kosongkan seluruh keadaan pembatas dan kunci in-flight. */
export function resetPembatasLaju() {
  penyimpanan.clear();
  sedangDiproses.clear();
  sapuTerakhir = 0;
}

/** Hanya untuk tes: jumlah kunci yang sedang disimpan. */
export function jumlahKunciTersimpan() {
  return penyimpanan.size;
}
