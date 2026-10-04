import { z } from "zod";

/**
 * Skema validasi untuk request POST /api/recommendations
 */
export const recommendationQuerySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  batas_anggaran: z.number().int().min(1000, "Batas anggaran minimal Rp1.000"),
  sela_waktu_menit: z.number().int().min(5, "Sela waktu minimal 5 menit").max(480, "Sela waktu maksimal 8 jam"),
  waktu: z.string().datetime().optional(),
  kecepatan_km_jam: z.number().positive().max(100).optional(),
  durasi_makan_menit: z.number().int().positive().max(180).optional(),
  jumlah: z.number().int().min(1).max(20).optional().default(5),
});

export type RecommendationQueryInput = z.infer<typeof recommendationQuerySchema>;
