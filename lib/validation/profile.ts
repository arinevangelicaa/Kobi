import { z } from "zod";

import { PESAN_NUL, tanpaNul } from "@/lib/validation/umum";
import { apakahTanggalValid } from "@/lib/validation/meal";

export const profileUpdateSchema = z
  .object({
    nama: z.string().trim().min(1, "Nama tidak boleh kosong.").max(100).refine(tanpaNul, PESAN_NUL).optional(),
    tanggal_lahir: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal lahir harus YYYY-MM-DD.")
      // Regex saja meloloskan 2003-02-31 (V8 menggulirkannya ke 2003-03-03) dan 2003-13-01.
      .refine(apakahTanggalValid, "Tanggal lahir tidak valid.")
      .optional()
      .nullable(),
    jenis_kelamin: z
      .enum(["L", "P", "laki-laki", "perempuan"])
      .optional()
      .nullable(),
    berat_badan_kg: z
      .number()
      .min(20, "Berat badan minimal 20 kg.")
      .max(300, "Berat badan maksimal 300 kg.")
      .optional()
      .nullable(),
    tinggi_badan_cm: z
      .number()
      .min(50, "Tinggi badan minimal 50 cm.")
      .max(250, "Tinggi badan maksimal 250 cm.")
      .optional()
      .nullable(),
    preferensi_anggaran: z
      .number()
      .int("Preferensi anggaran harus bilangan bulat.")
      .min(0, "Anggaran tidak boleh negatif.")
      // Kolom INT4; sama dengan batas total_harga di lib/validation/meal.ts.
      .max(100_000_000, "Anggaran terlalu besar.")
      .optional()
      .nullable(),
  })
  .strict();

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
