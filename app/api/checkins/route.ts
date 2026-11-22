import { NextResponse } from "next/server";

import { denganPenangananGalat, errorResponse, requireUser } from "@/lib/api";
import { buatCheckin } from "@/lib/services/meal-checkin";
import { checkinCreateSchema } from "@/lib/validation/checkin";

/**
 * POST /api/checkins (F5, #13) - check-in energi dan fokus untuk satu catatan makan.
 *
 * Body JSON:
 *   { "meal_log_id": uuid, "tingkat_energi": 1..5, "tingkat_fokus": 1..5,
 *     "catatan"?: string (maks 500 karakter) | null }
 *
 * 201:
 *   {
 *     "success": true,
 *     "checkin": { "id": uuid, "meal_log_id": uuid, "tingkat_energi": number,
 *                  "tingkat_fokus": number, "catatan": string | null, "waktu": ISO UTC }
 *   }
 *
 * Galat:
 *   400 VALIDATION_ERROR | 401 UNAUTHORIZED
 *   404 NOT_FOUND (meal_log tidak ada ATAU bukan milik pengguna)
 *   409 CHECKIN_EXISTS (catatan makan itu sudah punya check-in; satu per meal_log)
 *   503 DB_UNAVAILABLE
 */
async function handlePost(request: Request) {
  const hasil = await requireUser("Anda harus login untuk mengisi check-in.");
  if (!hasil.ok) return hasil.response;
  const { userId } = hasil;

  const body = await request.json().catch(() => null);
  const parsed = checkinCreateSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Data check-in tidak valid.",
    );
  }

  const buat = await buatCheckin(userId, parsed.data);

  if (buat.status === "meal_tidak_ditemukan") {
    return errorResponse(404, "NOT_FOUND", "Catatan makan tidak ditemukan.");
  }
  if (buat.status === "sudah_ada") {
    return errorResponse(409, "CHECKIN_EXISTS", "Catatan makan ini sudah punya check-in.");
  }

  return NextResponse.json({ success: true, checkin: buat.checkin }, { status: 201 });
}

export const POST = denganPenangananGalat(handlePost);
