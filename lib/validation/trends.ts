import { z } from "zod";

import { rentangHariWIB } from "@/lib/time-wib";

function tanggalWIBValid(nilai: string): boolean {
  try {
    rentangHariWIB(nilai);
    return true;
  } catch {
    return false;
  }
}

/**
 * Query GET /api/trends/weekly. `minggu` opsional: hari kalender WIB mana pun
 * (YYYY-MM-DD) di dalam minggu yang diminta. Kosong atau string kosong berarti
 * minggu berjalan. Minggu dihitung Senin-Minggu WIB oleh `rentangMingguWIB`.
 */
export const trendsWeeklyQuerySchema = z.object({
  minggu: z.preprocess(
    (nilai) => (nilai === "" || nilai === null ? undefined : nilai),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Parameter minggu harus berformat YYYY-MM-DD.")
      .refine(tanggalWIBValid, "Parameter minggu bukan tanggal yang valid.")
      .optional(),
  ),
});

export type TrendsWeeklyQueryInput = z.infer<typeof trendsWeeklyQuerySchema>;
