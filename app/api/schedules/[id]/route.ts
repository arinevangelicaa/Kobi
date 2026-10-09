import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return errorResponse(401, "UNAUTHORIZED", "Anda harus login untuk menghapus jadwal kuliah.");
  }

  const { id } = await params;

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
