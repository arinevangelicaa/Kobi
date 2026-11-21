/**
 * Helper bersama untuk Route Handler (docs/architecture.md bagian 5.2, 15).
 *
 * Format error seragam: `{ "error": { "code": "...", "message": "..." } }`.
 * Route Handler hanya autentikasi, validasi, dan panggil service, jadi
 * kerangka yang berulang diletakkan di sini.
 */

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  buatRequestId,
  denganRequestId,
  logger,
  requestIdDariRequest,
  requestIdSaatIni,
} from "@/lib/logger";

export function errorResponse(status: number, code: string, message: string) {
  const respons = NextResponse.json({ error: { code, message } }, { status });
  // Memudahkan pengguna/tim menautkan keluhan ke baris log. Hanya ada bila
  // handler berjalan di dalam `denganPenangananGalat`/`tanganiGalat`.
  const requestId = requestIdSaatIni();
  if (requestId) respons.headers.set("x-request-id", requestId);
  return respons;
}

export type HasilUser =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/**
 * Mengambil `user_id` dari sesi. `user_id` selalu dari sesi server, tidak
 * pernah dari body atau query (docs/architecture.md bagian 12).
 *
 * Pemakaian:
 *   const hasil = await requireUser("Anda harus login untuk mencatat makan.");
 *   if (!hasil.ok) return hasil.response;
 *   const { userId } = hasil;
 */
export async function requireUser(
  pesan = "Anda harus login untuk melanjutkan.",
): Promise<HasilUser> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { ok: false, response: errorResponse(401, "UNAUTHORIZED", pesan) };
  }
  return { ok: true, userId };
}

// Kode galat koneksi: Prisma (P1001 tidak terjangkau, P1002 timeout, P1017
// koneksi ditutup, P2024 pool habis) dan Node (soket).
const KODE_DB_TIDAK_TERSEDIA = new Set([
  "P1001",
  "P1002",
  "P1017",
  "P2024",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
]);

/**
 * Apakah galat ini berarti basis data tidak dapat dijangkau? Menelusuri rantai
 * `cause` karena driver adapter membungkus galat soket di dalam galat Prisma.
 */
export function apakahDbTidakTersedia(galat: unknown): boolean {
  let saat: unknown = galat;

  for (let kedalaman = 0; kedalaman < 5 && saat; kedalaman++) {
    if (typeof saat !== "object") return false;
    const { code, name, cause } = saat as { code?: unknown; name?: unknown; cause?: unknown };

    if (typeof code === "string" && KODE_DB_TIDAK_TERSEDIA.has(code)) return true;
    if (name === "PrismaClientInitializationError") return true;

    saat = cause;
  }
  return false;
}

/**
 * Mengubah galat tak terduga menjadi respons tanpa membocorkan detail internal
 * (docs/architecture.md bagian 15): DB tidak terjangkau jadi 503, sisanya 500.
 */
export function tanganiGalat(galat: unknown) {
  // Di dalam `denganPenangananGalat` request_id sudah ada; bila dipanggil
  // langsung dari catch milik route, buat satu supaya log dan respons cocok.
  const requestId = requestIdSaatIni() ?? buatRequestId();

  return denganRequestId(requestId, () => {
    const dbMati = apakahDbTidakTersedia(galat);
    const status = dbMati ? 503 : 500;

    logger.error(
      dbMati ? "Basis data tidak dapat dijangkau" : "Galat tak tertangani di Route Handler",
      { galat, status },
    );

    return dbMati
      ? errorResponse(
          503,
          "DB_UNAVAILABLE",
          "Layanan sedang tidak tersedia, coba lagi sebentar lagi.",
        )
      : errorResponse(500, "INTERNAL_ERROR", "Terjadi kesalahan di server, coba lagi.");
  });
}

/** Membungkus handler supaya galat yang lolos dibalas lewat `tanganiGalat`. */
export function denganPenangananGalat<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
) {
  return async (...args: A): Promise<Response> => {
    // Argumen pertama Route Handler adalah Request; pakai `x-request-id`
    // masuk bila aman, selain itu buat baru.
    const requestId = requestIdDariRequest(args[0] as Parameters<typeof requestIdDariRequest>[0]);

    return denganRequestId(requestId, async () => {
      try {
        return await handler(...args);
      } catch (galat) {
        return tanganiGalat(galat);
      }
    });
  };
}
