import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { registerSchema } from "@/lib/validation/auth";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Input tidak valid.",
    );
  }

  const { email, password, nama } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return errorResponse(409, "EMAIL_TAKEN", "Email sudah terdaftar.");
  }

  const password_hash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: { email, password_hash, nama },
      select: { id: true, email: true, nama: true, dibuat_pada: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    // Race condition: dua permintaan register email sama lolos findUnique
    // bersamaan. Constraint unik di kolom email menangkapnya di sini.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return errorResponse(409, "EMAIL_TAKEN", "Email sudah terdaftar.");
    }
    throw error;
  }
}
