import { NextResponse } from "next/server";

import { denganPenangananGalat, errorResponse, requireUser } from "@/lib/api";
import { reprosesEstimasi } from "@/lib/services/meal";
import { mealIdSchema } from "@/lib/validation/meal";

/**
 * POST /api/meals/{id}/estimate (#47) - memproses ulang estimasi gizi satu
 * catatan makan yang tertunda. Tanpa body.
 *
 * 200 (`status` memberi tahu apa yang terjadi):
 *   {
 *     "success": true,
 *     "status": "diproses" | "sudah_ada" | "tanpa_estimasi",
 *     "meal": { ...bentuk `meal` pada POST /api/meals },
 *     "items": [{ "nama": string, "porsi": string }],  // hanya terisi bila "diproses"
 *     "estimasi_tertunda": boolean,
 *     "rendah_keyakinan": boolean
 *   }
 *   - "diproses": estimasi baru berhasil dibuat dan disimpan.
 *   - "sudah_ada": catatan sudah punya estimasi; tidak ada panggilan AI (idempoten).
 *   - "tanpa_estimasi": AI gagal lagi; `estimasi_tertunda: true`, coba lagi nanti.
 *
 * Galat:
 *   401 UNAUTHORIZED
 *   404 NOT_FOUND (tidak ada ATAU bukan milik pengguna; sengaja tidak dibedakan,
 *       termasuk id yang bukan uuid) | 503 DB_UNAVAILABLE
 */
async function handlePost(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const hasil = await requireUser("Anda harus login untuk memproses ulang estimasi gizi.");
  if (!hasil.ok) return hasil.response;
  const { userId } = hasil;

  const { id } = await params;
  const idValid = mealIdSchema.safeParse(id);
  if (!idValid.success) {
    return errorResponse(404, "NOT_FOUND", "Catatan makan tidak ditemukan.");
  }

  const proses = await reprosesEstimasi(userId, idValid.data);

  if (proses.status === "tidak_ditemukan") {
    return errorResponse(404, "NOT_FOUND", "Catatan makan tidak ditemukan.");
  }

  return NextResponse.json({
    success: true,
    status: proses.status,
    meal: proses.catatan,
    items: proses.status === "diproses" ? proses.items : [],
    estimasi_tertunda: proses.catatan.estimasi_tertunda,
    rendah_keyakinan: proses.catatan.rendah_keyakinan,
  });
}

export const POST = denganPenangananGalat(handlePost);
