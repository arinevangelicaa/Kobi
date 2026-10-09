import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { scheduleCreateSchema } from "@/lib/validation/schedule";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function parseTimeToDate(jamStr: string): Date {
  const [h, m] = jamStr.split(":").map(Number);
  const d = new Date(1970, 0, 1, h, m, 0, 0);
  return d;
}

function formatPrismaTime(d: Date | null): string {
  if (!d) return "";
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return errorResponse(401, "UNAUTHORIZED", "Anda harus login untuk melihat jadwal kuliah.");
  }

  const schedules = await prisma.classSchedule.findMany({
    where: { user_id: userId },
    orderBy: [{ hari: "asc" }, { jam_mulai: "asc" }],
  });

  return NextResponse.json({
    schedules: schedules.map((s) => ({
      id: s.id,
      mata_kuliah: s.mata_kuliah,
      hari: s.hari,
      jam_mulai: formatPrismaTime(s.jam_mulai),
      jam_selesai: formatPrismaTime(s.jam_selesai),
      lokasi_ruang: s.lokasi_ruang,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return errorResponse(401, "UNAUTHORIZED", "Anda harus login untuk menambah jadwal kuliah.");
  }

  const body = await request.json().catch(() => null);
  const parsed = scheduleCreateSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Data jadwal kuliah tidak valid.",
    );
  }

  const data = parsed.data;

  const newSchedule = await prisma.classSchedule.create({
    data: {
      user_id: userId,
      mata_kuliah: data.mata_kuliah,
      hari: data.hari,
      jam_mulai: parseTimeToDate(data.jam_mulai),
      jam_selesai: parseTimeToDate(data.jam_selesai),
      lokasi_ruang: data.lokasi_ruang ?? null,
    },
  });

  return NextResponse.json(
    {
      success: true,
      schedule: {
        id: newSchedule.id,
        mata_kuliah: newSchedule.mata_kuliah,
        hari: newSchedule.hari,
        jam_mulai: data.jam_mulai,
        jam_selesai: data.jam_selesai,
        lokasi_ruang: newSchedule.lokasi_ruang,
      },
    },
    { status: 201 },
  );
}
