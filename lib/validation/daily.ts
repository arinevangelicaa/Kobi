import { z } from "zod";

import { rentangHariWIB } from "@/lib/time-wib";
import { apakahTanggalValid } from "@/lib/validation/meal";

/**
 * Skema query `?tanggal=` untuk GET /api/meals dan GET /api/nutrition/daily.
 * Kosong berarti hari ini menurut WIB (bukan zona waktu proses server).
 */
export const dailyQuerySchema = z.object({
  tanggal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus berformat YYYY-MM-DD.")
    .refine(apakahTanggalValid, "Tanggal tidak valid.")
    .optional()
    .transform((nilai) => nilai ?? rentangHariWIB().tanggal),
});

export type DailyQueryInput = z.infer<typeof dailyQuerySchema>;
