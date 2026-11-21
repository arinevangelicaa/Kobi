import { z } from "zod";

import { rentangHariWIB } from "@/lib/time-wib";

/** Batas teks bebas dari pengguna. Cukup untuk beberapa item makanan, menahan biaya token. */
export const BATAS_TEKS_INPUT = 500;

/** `z.guid()` menerima semua uuid Postgres; `z.uuid()` Zod 4 menolak varian non-RFC. */
const idSchema = (pesan: string) => z.guid(pesan);

/**
 * Skema body POST /api/meals (docs/architecture.md bagian 6 dan 7.2).
 *
 * `waktu_makan` opsional dan jatuh ke waktu sekarang. `user_id` sengaja tidak
 * ada di sini: selalu dari sesi (bagian 12).
 */
export const mealCreateSchema = z.object({
  teks_input: z
    .string({ error: "Teks makanan wajib diisi." })
    .trim()
    .min(1, "Teks makanan tidak boleh kosong.")
    .max(BATAS_TEKS_INPUT, `Teks makanan maksimal ${BATAS_TEKS_INPUT} karakter.`),
  waktu_makan: z
    .string()
    .datetime({ offset: true, error: "Waktu makan harus berformat tanggal-waktu ISO 8601." })
    .optional()
    .transform((nilai) => (nilai ? new Date(nilai) : new Date())),
  vendor_id: idSchema("vendor_id harus berupa uuid yang valid.").optional(),
  total_harga: z
    .number({ error: "Total harga harus berupa angka." })
    .int("Total harga harus bilangan bulat (Rupiah).")
    .min(0, "Total harga tidak boleh negatif.")
    .max(100_000_000, "Total harga terlalu besar.")
    .optional(),
});

export type MealCreateInput = z.infer<typeof mealCreateSchema>;

/** Format YYYY-MM-DD yang juga kalender-valid (31 Februari ditolak). */
export function apakahTanggalValid(nilai: string): boolean {
  try {
    rentangHariWIB(nilai);
    return true;
  } catch {
    return false;
  }
}

/** Parameter path `[id]` catatan makan. Format salah diperlakukan sama dengan tidak ada (404). */
export const mealIdSchema = idSchema("Catatan makan tidak ditemukan.");
