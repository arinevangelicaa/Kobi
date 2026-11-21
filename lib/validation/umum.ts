/**
 * Pembantu validasi yang dipakai bersama oleh beberapa skema Zod.
 */

/** Postgres menolak karakter NUL (\u0000) di kolom text, jadi tolak di batas masuk (400), bukan 500. */
export const tanpaNul = (nilai: string): boolean => !nilai.includes("\u0000");

export const PESAN_NUL = "Teks tidak boleh memuat karakter kontrol NUL.";
