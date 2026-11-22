/**
 * F5 - check-in energi dan fokus setelah makan (docs/architecture.md bagian
 * 7.2 dan 8.4). Satu check-in per `meal_log` (kolom `meal_log_id` unik).
 *
 * Tanpa HTTP; klien basis data bisa diinjeksi untuk tes. `user_id` selalu dari
 * sesi: kepemilikan `meal_log` dicek dengan menyertakan `user_id` di query,
 * sehingga catatan orang lain tampak sama dengan catatan yang tidak ada.
 */

import type { PrismaClient } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";

export type DbCheckin = Pick<PrismaClient, "mealLog" | "checkin">;

export interface InputCheckin {
  meal_log_id: string;
  tingkat_energi: number;
  tingkat_fokus: number;
  catatan?: string | null;
}

export interface CheckinDto {
  id: string;
  meal_log_id: string;
  tingkat_energi: number;
  tingkat_fokus: number;
  catatan: string | null;
  /** ISO 8601 UTC. */
  waktu: string;
}

export type HasilCheckin =
  | { status: "tersimpan"; checkin: CheckinDto }
  /** `meal_log` tidak ada atau bukan milik pengguna. */
  | { status: "meal_tidak_ditemukan" }
  /** Catatan makan ini sudah punya check-in. */
  | { status: "sudah_ada" };

function kodeGalat(galat: unknown): string | undefined {
  if (typeof galat !== "object" || galat === null) return undefined;
  const { code } = galat as { code?: unknown };
  return typeof code === "string" ? code : undefined;
}

/** Menyimpan satu check-in untuk catatan makan milik `userId`. */
export async function buatCheckin(
  userId: string,
  input: InputCheckin,
  db: DbCheckin = prisma,
): Promise<HasilCheckin> {
  const meal = await db.mealLog.findFirst({
    where: { id: input.meal_log_id, user_id: userId },
    select: { id: true },
  });
  if (!meal) return { status: "meal_tidak_ditemukan" };

  try {
    const dibuat = await db.checkin.create({
      data: {
        user_id: userId,
        meal_log_id: meal.id,
        tingkat_energi: input.tingkat_energi,
        tingkat_fokus: input.tingkat_fokus,
        catatan: input.catatan ?? null,
      },
    });

    return {
      status: "tersimpan",
      checkin: {
        id: dibuat.id,
        meal_log_id: dibuat.meal_log_id,
        tingkat_energi: dibuat.tingkat_energi,
        tingkat_fokus: dibuat.tingkat_fokus,
        catatan: dibuat.catatan,
        waktu: dibuat.waktu.toISOString(),
      },
    };
  } catch (galat) {
    // P2002: meal_log_id sudah punya check-in (termasuk dua permintaan bersamaan).
    if (kodeGalat(galat) === "P2002") return { status: "sudah_ada" };
    throw galat;
  }
}
