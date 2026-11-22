import { NextResponse } from "next/server";

import { denganPenangananGalat, errorResponse, requireUser } from "@/lib/api";
import { batasiLaju } from "@/lib/rate-limit";
import { dapatkanGiziHarian } from "@/lib/services/daily-nutrition";
import { catatMakan, riwayatMakanHarian } from "@/lib/services/meal";
import { dailyQuerySchema } from "@/lib/validation/daily";
import { mealCreateSchema } from "@/lib/validation/meal";

/**
 * POST /api/meals (F1, F2) - mencatat makan dan memperkirakan gizinya.
 *
 * Body JSON:
 *   { "teks_input": string (wajib, 1-500 karakter),
 *     "waktu_makan"?: string ISO 8601 dengan offset (default sekarang),
 *     "vendor_id"?: uuid, "total_harga"?: integer >= 0 (Rupiah) }
 *
 * 201:
 *   {
 *     "success": true,
 *     "meal": {
 *       "id": uuid, "teks_input": string, "vendor_id": uuid | null,
 *       "total_harga": number | null,      // nilai pengguna, atau estimasi_harga model bila kosong
 *       "waktu_makan": ISO UTC, "dibuat_pada": ISO UTC,
 *       "estimasi": { "kalori_estimasi": number, "protein_g": number, "karbohidrat_g": number,
 *                     "lemak_g": number, "zat_besi_mg": number, "tingkat_keyakinan": 0..1,
 *                     "model_versi": string } | null,   // null bila estimasi tertunda
 *       "estimasi_tertunda": boolean,
 *       "rendah_keyakinan": boolean
 *     },
 *     "items": [{ "nama": string, "porsi": string }],  // dari model; [] bila tertunda
 *     "estimasi_tertunda": boolean,   // salinan dari meal.estimasi_tertunda
 *     "rendah_keyakinan": boolean,    // salinan dari meal.rendah_keyakinan
 *     "gizi_harian": { "tanggal": "YYYY-MM-DD", "target": {...} | null, "asupan": {...},
 *                      "kesenjangan": [...], "jumlah_catatan": number,
 *                      "jumlah_tanpa_estimasi": number } | null
 *   }
 *   Bila estimasi AI gagal, catatan TETAP tersimpan: tetap 201 dengan
 *   `estimasi_tertunda: true`, `estimasi: null`; proses ulang lewat
 *   POST /api/meals/{id}/estimate. `gizi_harian` dihitung untuk hari WIB dari
 *   `waktu_makan` (bukan selalu hari ini); null bila perhitungan itu gagal.
 *
 * Galat (format `{ "error": { "code", "message" } }`):
 *   400 VALIDATION_ERROR (input salah) | 400 VENDOR_NOT_FOUND (vendor_id tidak ada)
 *   401 UNAUTHORIZED | 429 RATE_LIMITED (header `Retry-After` dalam detik;
 *   batas `BATAS.catatMakan` di lib/rate-limit.ts) | 503 DB_UNAVAILABLE
 */
async function handlePost(request: Request) {
  const hasil = await requireUser("Anda harus login untuk mencatat makan.");
  if (!hasil.ok) return hasil.response;
  const { userId } = hasil;

  // Sebelum memanggil AI (lewat catatMakan) supaya permintaan ditolak murah.
  const ditolak = batasiLaju("catatMakan", userId);
  if (ditolak) return ditolak;

  const body = await request.json().catch(() => null);
  const parsed = mealCreateSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Data catatan makan tidak valid.",
    );
  }

  const catat = await catatMakan(userId, parsed.data);

  if (catat.status === "vendor_tidak_valid") {
    return errorResponse(400, "VENDOR_NOT_FOUND", "Warung dengan vendor_id tersebut tidak ditemukan.");
  }

  // Catatan sudah tersimpan. Gagal menghitung ringkasan tidak boleh membuat
  // respons gagal, supaya pengguna tidak mengulang dan menggandakan catatan.
  let giziHarian = null;
  try {
    giziHarian = await dapatkanGiziHarian(userId, new Date(catat.catatan.waktu_makan));
  } catch (galat) {
    console.error("Gagal menghitung gizi harian setelah mencatat makan:", galat);
  }

  return NextResponse.json(
    {
      success: true,
      meal: catat.catatan,
      items: catat.items,
      estimasi_tertunda: catat.catatan.estimasi_tertunda,
      rendah_keyakinan: catat.catatan.rendah_keyakinan,
      gizi_harian: giziHarian,
    },
    { status: 201 },
  );
}

/**
 * GET /api/meals?tanggal=YYYY-MM-DD (F1) - riwayat makan satu hari WIB.
 * `tanggal` opsional, default hari ini menurut WIB.
 *
 * 200:
 *   {
 *     "success": true,
 *     "tanggal": "YYYY-MM-DD",
 *     "count": number,
 *     "meals": [ {                       // terbaru dulu
 *       ...bentuk `meal` pada POST /api/meals,
 *       "estimasi_tertunda": boolean,    // true bila belum punya estimasi
 *       "rendah_keyakinan": boolean,
 *       "sudah_checkin": boolean         // true bila sudah ada check-in (F5)
 *     } ]
 *   }
 *   `items` tidak ikut karena tidak disimpan di basis data.
 *
 * Galat: 400 VALIDATION_ERROR (tanggal salah) | 401 UNAUTHORIZED | 503 DB_UNAVAILABLE
 */
async function handleGet(request: Request) {
  const hasil = await requireUser("Anda harus login untuk melihat riwayat makan.");
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

  const riwayat = await riwayatMakanHarian(userId, parsed.data.tanggal);

  return NextResponse.json({
    success: true,
    tanggal: riwayat.tanggal,
    count: riwayat.meals.length,
    meals: riwayat.meals,
  });
}

export const POST = denganPenangananGalat(handlePost);
export const GET = denganPenangananGalat(handleGet);
