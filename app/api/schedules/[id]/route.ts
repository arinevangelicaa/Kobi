import { NextResponse } from "next/server";
import { z } from "zod";

import { denganPenangananGalat, errorResponse } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Id bukan uuid dibalas 404 seperti "tidak ada"; tanpa ini `findUnique` pada
// kolom UUID melempar galat Prisma (P2023) dan klien menerima 500.
const idSchema = z.guid();

async function handleDelete(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return errorResponse(401, "UNAUTHORIZED", "Anda harus login untuk menghapus jadwal kuliah.");
  }

  const { id } = await params;

  if (!idSchema.safeParse(id).success) {
    return errorResponse(404, "NOT_FOUND", "Jadwal kuliah tidak ditemukan.");
  }

  const existingSchedule = await prisma.classSchedule.findUnique({
    where: { id },
  });

  if (!existingSchedule) {
    return errorResponse(404, "NOT_FOUND", "Jadwal kuliah tidak ditemukan.");
  }

  if (existingSchedule.user_id !== userId) {
    return errorResponse(
      403,
      "FORBIDDEN",
      "Anda tidak memiliki izin untuk menghapus jadwal kuliah ini.",
    );
  }

  await prisma.classSchedule.delete({
    where: { id },
  });

  return new NextResponse(null, { status: 204 });
}

export const DELETE = denganPenangananGalat(handleDelete);
