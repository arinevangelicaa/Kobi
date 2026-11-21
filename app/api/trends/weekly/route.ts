import { NextResponse } from "next/server";

import { denganPenangananGalat, errorResponse, requireUser } from "@/lib/api";
import { narasiPolaDariAgregat } from "@/lib/azure/openai";
import { prisma } from "@/lib/db";
import { batasiLaju } from "@/lib/rate-limit";
import {
  DISCLAIMER_TREN,
  ambilCheckinMinggu,
  hitungTrenMingguan,
  keAgregatNarasi,
  rentangMingguWIB,
} from "@/lib/services/trend-insight";
import { trendsWeeklyQuerySchema } from "@/lib/validation/trends";

/**
 * GET /api/trends/weekly?minggu=YYYY-MM-DD
 *
 * Ringkasan pola energi dan fokus satu minggu (Senin-Minggu WIB) milik
 * pengguna yang login. `minggu` opsional: hari WIB mana pun di dalam minggu
 * yang diminta; kosong berarti minggu berjalan. Rata-rata dihitung di kode,
 * narasi disusun model hanya dari angka itu (atau template cadangan).
 *
 * Respons 200:
 * ```json
 * {
 *   "minggu": { "mulai": "2026-11-16", "selesai": "2026-11-22" },
 *   "status": "ok",                      // atau "data_kurang" (keadaan kosong)
 *   "jumlah_checkin": 9,
 *   "jumlah_dengan_estimasi": 8,         // check-in yang catatan makannya punya estimasi
 *   "rata_energi": 3.4,                  // skala 1-5, null bila belum ada check-in
 *   "rata_fokus": 3.1,
 *   "per_rentang_protein": [             // protein per makan; selalu 3 rentang
 *     {
 *       "kunci": "rendah",               // "rendah" | "sedang" | "tinggi"
 *       "label": "rendah (kurang dari 10 g)",
 *       "batas_bawah_g": 0,
 *       "batas_atas_g": 10,              // null pada rentang tertinggi
 *       "jumlah_checkin": 3,
 *       "rata_energi": 2.7,              // null bila rentang kosong
 *       "rata_fokus": 2.3,
 *       "cukup_data": true               // minimal 2 check-in, boleh dibandingkan
 *     }
 *   ],
 *   "narasi": {
 *     "teks": "Minggu ini Anda mengisi 9 check-in, ...",   // maksimal 3 kalimat
 *     "sumber": "model"                  // atau "template" (cadangan deterministik)
 *   },
 *   "disclaimer": "Ringkasan ini hanya gambaran pola ... bukan diagnosis medis ..."
 * }
 * ```
 * Bila `status` "data_kurang" (kurang dari 3 check-in), UI menampilkan ajakan
 * mengisi check-in, bukan grafik pola; `narasi.sumber` selalu "template".
 *
 * Galat: 400 `VALIDATION_ERROR` (minggu tidak valid), 401 `UNAUTHORIZED`,
 * 429 `RATE_LIMITED` (header `Retry-After` dalam detik; batas
 * `BATAS.trenMingguan` di lib/rate-limit.ts),
 * 503 `DB_UNAVAILABLE`, 500 `INTERNAL_ERROR`.
 */
async function handleGet(request: Request) {
  const hasil = await requireUser("Anda harus login untuk melihat tren.");
  if (!hasil.ok) return hasil.response;

  // Sebelum DB dan model narasi, supaya permintaan ditolak murah.
  const ditolak = batasiLaju("trenMingguan", hasil.userId);
  if (ditolak) return ditolak;

  const { searchParams } = new URL(request.url);
  const parsed = trendsWeeklyQuerySchema.safeParse({
    minggu: searchParams.get("minggu") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Parameter minggu tidak valid.",
    );
  }

  const minggu = rentangMingguWIB(parsed.data.minggu);
  const data = await ambilCheckinMinggu(prisma, hasil.userId, minggu);
  const tren = hitungTrenMingguan(data, minggu);
  const narasi = await narasiPolaDariAgregat(keAgregatNarasi(tren));

  return NextResponse.json({ ...tren, narasi, disclaimer: DISCLAIMER_TREN });
}

export const GET = denganPenangananGalat(handleGet);
