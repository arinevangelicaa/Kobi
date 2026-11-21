/**
 * Batas hari dalam WIB (Asia/Jakarta, UTC+7, tanpa DST).
 *
 * "Hari ini" bagi pengguna Kobi adalah hari kalender WIB, bukan hari kalender
 * proses Node. Memakai `new Date().setHours(0, 0, 0, 0)` menghasilkan tengah
 * malam zona waktu proses: WIB di mesin pengembang, tetapi UTC di Azure App
 * Service dan runner GitHub Actions, sehingga catatan makan jam 00:00-06:59
 * WIB masuk ke "hari kemarin" (kelas bug yang sama dengan issue #39 dan #44).
 *
 * Fungsi di sini hanya memakai aritmetika UTC, jadi hasilnya tidak bergantung
 * pada TZ proses. Untuk kolom TIME (jam dinding), pakai `lib/db-time.ts`.
 * Modul ini untuk kolom timestamptz seperti `meal_logs.waktu_makan`.
 */

const OFFSET_WIB_MS = 7 * 60 * 60 * 1000;
const SATU_HARI_MS = 24 * 60 * 60 * 1000;
const POLA_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface RentangHari {
  /** Hari kalender WIB, format YYYY-MM-DD. */
  tanggal: string;
  /** Tengah malam WIB awal hari ini (inklusif), sebagai instant UTC. */
  awal: Date;
  /** Tengah malam WIB hari berikutnya (eksklusif), sebagai instant UTC. */
  akhir: Date;
}

function pad(angka: number, lebar: number): string {
  return String(angka).padStart(lebar, "0");
}

function dariKomponen(tahun: number, bulan: number, tanggal: number): RentangHari {
  const awalMs = Date.UTC(tahun, bulan - 1, tanggal) - OFFSET_WIB_MS;
  const cek = new Date(awalMs + OFFSET_WIB_MS);

  // Date.UTC meluapkan nilai di luar rentang (31 Februari jadi Maret), jadi
  // bandingkan balik supaya tanggal tidak valid ditolak, bukan digeser diam-diam.
  if (
    cek.getUTCFullYear() !== tahun ||
    cek.getUTCMonth() !== bulan - 1 ||
    cek.getUTCDate() !== tanggal
  ) {
    throw new RangeError("Tanggal tidak valid.");
  }

  return {
    tanggal: `${pad(tahun, 4)}-${pad(bulan, 2)}-${pad(tanggal, 2)}`,
    awal: new Date(awalMs),
    akhir: new Date(awalMs + SATU_HARI_MS),
  };
}

/**
 * Rentang satu hari kalender WIB.
 *
 * - `Date`: hari WIB yang memuat instant itu.
 * - `string` "YYYY-MM-DD": hari kalender WIB tersebut.
 * - kosong: hari WIB saat ini.
 *
 * Melempar RangeError untuk string atau Date yang tidak valid.
 */
export function rentangHariWIB(acuan: string | Date = new Date()): RentangHari {
  if (typeof acuan === "string") {
    const cocok = POLA_TANGGAL.exec(acuan);
    if (!cocok) throw new RangeError("Format tanggal harus YYYY-MM-DD.");
    return dariKomponen(Number(cocok[1]), Number(cocok[2]), Number(cocok[3]));
  }

  if (Number.isNaN(acuan.getTime())) throw new RangeError("Waktu tidak valid.");

  const geser = new Date(acuan.getTime() + OFFSET_WIB_MS);
  return dariKomponen(geser.getUTCFullYear(), geser.getUTCMonth() + 1, geser.getUTCDate());
}
