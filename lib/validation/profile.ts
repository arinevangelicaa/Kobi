import { z } from "zod";

export const profileUpdateSchema = z
  .object({
    nama: z.string().trim().min(1, "Nama tidak boleh kosong.").max(100).optional(),
    tanggal_lahir: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal lahir harus YYYY-MM-DD.")
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
      .optional()
      .nullable(),
  })
  .strict();

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
