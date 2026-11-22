import { NextResponse } from "next/server";

import { denganPenangananGalat, errorResponse, requireUser } from "@/lib/api";
import { dapatkanGiziHarian } from "@/lib/services/daily-nutrition";
import { dailyQuerySchema } from "@/lib/validation/daily";

/**
 * GET /api/nutrition/daily?tanggal=YYYY-MM-DD (F2, #48) - target, akumulasi,
 * dan kesenjangan gizi satu hari WIB. `tanggal` opsional, default hari ini WIB.
 *
 * 200:
 *   {
 *     "success": true,
 *     "gizi_harian": {
 *       "tanggal": "YYYY-MM-DD",
 *       "target": { "protein_g", "karbohidrat_g", "lemak_g", "zat_besi_mg", "kalori" } | null,
 *       "asupan": { "protein_g", "karbohidrat_g", "lemak_g", "zat_besi_mg", "kalori" },
 *       "kesenjangan": [ ... ],   // terurut dari yang paling kurang; [] bila target null
 *       "jumlah_catatan": number,
 *       "jumlah_tanpa_estimasi": number,   // catatan tertunda, belum ikut asupan
 *       "jumlah_keyakinan_rendah": number // catatan berestimasi, tetap ikut asupan
 *     }
 *   }
 *   Bentuk `kesenjangan` mengikuti `Kesenjangan` di lib/services/nutrition-gap.ts.
 *
 * Galat: 400 VALIDATION_ERROR (tanggal salah) | 401 UNAUTHORIZED | 503 DB_UNAVAILABLE
 */
async function handleGet(request: Request) {
  const hasil = await requireUser("Anda harus login untuk melihat ringkasan gizi.");
  if (!hasil.ok) return hasil.response;
  const { userId } = hasil;

  const { searchParams } = new URL(request.url);
  const parsed = dailyQuerySchema.safeParse({ tanggal: searchParams.get("tanggal") ?? undefined });

  if (!parsed.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Parameter tanggal tidak valid.",
    );
  }

  const gizi = await dapatkanGiziHarian(userId, parsed.data.tanggal);

  return NextResponse.json({ success: true, gizi_harian: gizi });
}

export const GET = denganPenangananGalat(handleGet);
