/**
 * Logger terstruktur (docs/architecture.md bagian 15).
 *
 * Satu entri = satu baris JSON dengan `level`, `pesan`, `waktu`, `request_id`,
 * lalu konteks tambahan. Azure App Service menangkap stdout/stderr, dan
 * Application Insights/Log Analytics dapat mengurai baris JSON ini.
 *
 * Aturan keras: log tidak pernah memuat password, isi cookie, header
 * Authorization, rahasia, maupun `teks_input` utuh. Setiap konteks dilewatkan
 * `redaksi()` sebelum ditulis, jadi pemanggil tidak perlu mengingatnya.
 *
 * Modul ini hanya untuk runtime Node.js (memakai AsyncLocalStorage), bukan Edge.
 */

import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

export type LevelLog = "debug" | "info" | "warn" | "error";

export const NILAI_REDAKSI = "[REDAKSI]";

// Dibandingkan setelah nama kunci diubah ke huruf kecil tanpa pemisah, jadi
// `password_hash`, `passwordHash`, `Set-Cookie`, dan `AUTH_SECRET` semuanya
// tertangkap lewat potongan di bawah.
const POTONGAN_KUNCI_SENSITIF = [
  "password",
  "passwd",
  "cookie",
  "authorization",
  "teksinput",
  "secret",
  // Bukan "token" polos: itu ikut menyamarkan hitungan token model (max_tokens).
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "csrftoken",
  "apikey",
  "connectionstring",
  "databaseurl",
  "sessionid",
] as const;

function normalisasiKunci(kunci: string): string {
  return kunci.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function apakahKunciSensitif(kunci: string): boolean {
  const norm = normalisasiKunci(kunci);
  return POTONGAN_KUNCI_SENSITIF.some((potongan) => norm.includes(potongan));
}

// postgresql://user:password@host -> postgresql://[REDAKSI]@host
const KREDENSIAL_URL = /([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]*@/gi;

function redaksiString(nilai: string): string {
  return nilai.replace(KREDENSIAL_URL, `$1${NILAI_REDAKSI}@`);
}

const KEDALAMAN_MAKS = 6;

function redaksiGalat(galat: Error, kedalaman: number, terlihat: WeakSet<object>): unknown {
  const hasil: Record<string, unknown> = {
    name: galat.name,
    message: redaksiString(galat.message),
  };
  const kode = (galat as { code?: unknown }).code;
  if (typeof kode === "string" || typeof kode === "number") hasil.code = kode;
  if (galat.stack) hasil.stack = redaksiString(galat.stack);
  if (galat.cause !== undefined) {
    hasil.cause = redaksiNilai(galat.cause, kedalaman + 1, terlihat);
  }
  return hasil;
}

function redaksiNilai(nilai: unknown, kedalaman: number, terlihat: WeakSet<object>): unknown {
  if (typeof nilai === "string") return redaksiString(nilai);
  if (nilai === null || typeof nilai === "number" || typeof nilai === "boolean") return nilai;
  if (nilai === undefined) return undefined;
  if (typeof nilai === "bigint") return nilai.toString();
  if (typeof nilai === "symbol" || typeof nilai === "function") return String(nilai);

  if (kedalaman >= KEDALAMAN_MAKS) return "[TERLALU DALAM]";
  if (terlihat.has(nilai as object)) return "[SIKLIS]";
  terlihat.add(nilai as object);

  try {
    if (nilai instanceof Error) return redaksiGalat(nilai, kedalaman, terlihat);
    if (nilai instanceof Date) return nilai.toISOString();
    if (Array.isArray(nilai)) {
      return nilai.map((item) => redaksiNilai(item, kedalaman + 1, terlihat));
    }

    const hasil: Record<string, unknown> = {};
    for (const [kunci, isi] of Object.entries(nilai as Record<string, unknown>)) {
      hasil[kunci] = apakahKunciSensitif(kunci)
        ? NILAI_REDAKSI
        : redaksiNilai(isi, kedalaman + 1, terlihat);
    }
    return hasil;
  } finally {
    // Hanya mendeteksi siklus (leluhur), bukan objek yang dipakai ulang.
    terlihat.delete(nilai as object);
  }
}

/**
 * Menyalin `nilai` dengan semua kunci sensitif diganti `[REDAKSI]` (di tingkat
 * mana pun), kredensial dalam URL disamarkan, dan `Error` diserialkan.
 */
export function redaksi(nilai: unknown): unknown {
  return redaksiNilai(nilai, 0, new WeakSet());
}

// --- request_id ----------------------------------------------------------

const POLA_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function buatRequestId(): string {
  return randomUUID();
}

/**
 * Memakai `x-request-id` dari permintaan masuk (mis. dari proxy Azure) bila
 * bentuknya aman; selain itu membuat yang baru. Nilai dari klien tidak
 * dipercaya mentah-mentah supaya tidak bisa menyisipkan baris palsu ke log.
 */
export function requestIdDariRequest(request?: { headers?: { get(nama: string): string | null } }) {
  const masuk = request?.headers?.get?.("x-request-id");
  return masuk && POLA_REQUEST_ID.test(masuk) ? masuk : buatRequestId();
}

const penyimpanKonteks = new AsyncLocalStorage<{ requestId: string }>();

/** Menjalankan `fn` dengan `requestId` yang terbawa ke semua log di dalamnya. */
export function denganRequestId<T>(requestId: string, fn: () => T): T {
  return penyimpanKonteks.run({ requestId }, fn);
}

export function requestIdSaatIni(): string | undefined {
  return penyimpanKonteks.getStore()?.requestId;
}

// --- logger --------------------------------------------------------------

export type Konteks = Record<string, unknown>;

export type Penulis = (level: LevelLog, baris: string) => void;

const penulisBawaan: Penulis = (level, baris) => {
  if (level === "error") console.error(baris);
  else if (level === "warn") console.warn(baris);
  else console.log(baris);
};

const KUNCI_INTI = new Set(["level", "pesan", "waktu", "request_id"]);

/** Membentuk satu baris JSON untuk satu entri log (tanpa newline di dalamnya). */
export function formatEntri(
  level: LevelLog,
  pesan: string,
  konteks: Konteks = {},
  requestId: string | undefined = requestIdSaatIni(),
  waktu: Date = new Date(),
): string {
  const entri: Record<string, unknown> = {
    level,
    pesan: redaksiString(pesan),
    waktu: waktu.toISOString(),
  };
  if (requestId) entri.request_id = requestId;

  const aman = redaksi(konteks) as Konteks;
  for (const [kunci, isi] of Object.entries(aman)) {
    if (!KUNCI_INTI.has(kunci)) entri[kunci] = isi;
  }

  try {
    return JSON.stringify(entri);
  } catch {
    return JSON.stringify({
      level,
      pesan: "Entri log gagal diserialkan.",
      waktu: entri.waktu,
      ...(requestId ? { request_id: requestId } : {}),
    });
  }
}

export function buatLogger(tulis: Penulis = penulisBawaan) {
  const catat = (level: LevelLog, pesan: string, konteks?: Konteks) =>
    tulis(level, formatEntri(level, pesan, konteks));

  return {
    debug: (pesan: string, konteks?: Konteks) => catat("debug", pesan, konteks),
    info: (pesan: string, konteks?: Konteks) => catat("info", pesan, konteks),
    warn: (pesan: string, konteks?: Konteks) => catat("warn", pesan, konteks),
    error: (pesan: string, konteks?: Konteks) => catat("error", pesan, konteks),
  };
}

export const logger = buatLogger();
