import { z } from "zod";

import { PESAN_NUL, tanpaNul } from "@/lib/validation/umum";

const skala = (nama: string) =>
  z
    .number({ error: `${nama} harus berupa angka 1 sampai 5.` })
    .int(`${nama} harus bilangan bulat 1 sampai 5.`)
    .min(1, `${nama} harus bernilai 1 sampai 5.`)
    .max(5, `${nama} harus bernilai 1 sampai 5.`);

/** Skema body POST /api/checkins (docs/architecture.md bagian 6, 7.2, 8.4). */
export const checkinCreateSchema = z.object({
  meal_log_id: z.guid("meal_log_id harus berupa uuid yang valid."),
  tingkat_energi: skala("Tingkat energi"),
  tingkat_fokus: skala("Tingkat fokus"),
  catatan: z
    .string()
    .trim()
    .max(500, "Catatan maksimal 500 karakter.")
    .refine(tanpaNul, PESAN_NUL)
    .optional()
    .nullable(),
});

export type CheckinCreateInput = z.infer<typeof checkinCreateSchema>;
