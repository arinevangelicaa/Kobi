import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hitungTargetGizi } from "@/lib/services/nutrition-target";
import { profileUpdateSchema } from "@/lib/validation/profile";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return errorResponse(401, "UNAUTHORIZED", "Anda harus login untuk mengakses profil.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      nama: true,
      tanggal_lahir: true,
      jenis_kelamin: true,
      berat_badan_kg: true,
      tinggi_badan_cm: true,
      preferensi_anggaran: true,
      dibuat_pada: true,
    },
  });

  if (!user) {
    return errorResponse(404, "NOT_FOUND", "Pengguna tidak ditemukan.");
  }

  // Ambil target gizi terbaru
  const activeTarget = await prisma.nutritionTarget.findFirst({
    where: { user_id: userId },
    orderBy: { berlaku_sejak: "desc" },
  });

  return NextResponse.json({
    user: {
      ...user,
      tanggal_lahir: user.tanggal_lahir ? user.tanggal_lahir.toISOString().split("T")[0] : null,
      berat_badan_kg: user.berat_badan_kg ? Number(user.berat_badan_kg) : null,
      tinggi_badan_cm: user.tinggi_badan_cm ? Number(user.tinggi_badan_cm) : null,
    },
    nutrition_target: activeTarget
      ? {
          id: activeTarget.id,
          kalori_target: activeTarget.kalori_target,
          protein_target_g: Number(activeTarget.protein_target_g),
          karbohidrat_target_g: Number(activeTarget.karbohidrat_target_g),
          lemak_target_g: Number(activeTarget.lemak_target_g),
          zat_besi_target_mg: Number(activeTarget.zat_besi_target_mg),
          berlaku_sejak: activeTarget.berlaku_sejak.toISOString().split("T")[0],
        }
      : null,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return errorResponse(401, "UNAUTHORIZED", "Anda harus login untuk mengubah profil.");
  }

  const body = await request.json().catch(() => null);
  const parsed = profileUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Data update profil tidak valid.",
    );
  }

  const data = parsed.data;

  // Cek apakah data fisik diubah (memicu pembuatan baris nutrition_target baru)
  const isPhysicalDataChanged =
    data.tanggal_lahir !== undefined ||
    data.jenis_kelamin !== undefined ||
    data.berat_badan_kg !== undefined ||
    data.tinggi_badan_cm !== undefined;

  // Lakukan update user
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.nama !== undefined && { nama: data.nama }),
      ...(data.tanggal_lahir !== undefined && {
        tanggal_lahir: data.tanggal_lahir ? new Date(data.tanggal_lahir) : null,
      }),
      ...(data.jenis_kelamin !== undefined && { jenis_kelamin: data.jenis_kelamin }),
      ...(data.berat_badan_kg !== undefined && { berat_badan_kg: data.berat_badan_kg }),
      ...(data.tinggi_badan_cm !== undefined && { tinggi_badan_cm: data.tinggi_badan_cm }),
      ...(data.preferensi_anggaran !== undefined && {
        preferensi_anggaran: data.preferensi_anggaran,
      }),
    },
    select: {
      id: true,
      email: true,
      nama: true,
      tanggal_lahir: true,
      jenis_kelamin: true,
      berat_badan_kg: true,
      tinggi_badan_cm: true,
      preferensi_anggaran: true,
    },
  });

  let newNutritionTarget = null;

  if (isPhysicalDataChanged) {
    // Hitung target nutrisi baru
    const targets = hitungTargetGizi({
      tanggal_lahir: updatedUser.tanggal_lahir,
      jenis_kelamin: updatedUser.jenis_kelamin,
      berat_badan_kg: updatedUser.berat_badan_kg ? Number(updatedUser.berat_badan_kg) : null,
      tinggi_badan_cm: updatedUser.tinggi_badan_cm ? Number(updatedUser.tinggi_badan_cm) : null,
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    newNutritionTarget = await prisma.nutritionTarget.create({
      data: {
        user_id: userId,
        kalori_target: targets.kalori_target,
        protein_target_g: targets.protein_target_g,
        karbohidrat_target_g: targets.karbohidrat_target_g,
        lemak_target_g: targets.lemak_target_g,
        zat_besi_target_mg: targets.zat_besi_target_mg,
        berlaku_sejak: today,
      },
    });
  } else {
    // Ambil target nutrisi aktif saat ini
    newNutritionTarget = await prisma.nutritionTarget.findFirst({
      where: { user_id: userId },
      orderBy: { berlaku_sejak: "desc" },
    });
  }

  return NextResponse.json({
    success: true,
    user: {
      ...updatedUser,
      tanggal_lahir: updatedUser.tanggal_lahir
        ? updatedUser.tanggal_lahir.toISOString().split("T")[0]
        : null,
      berat_badan_kg: updatedUser.berat_badan_kg ? Number(updatedUser.berat_badan_kg) : null,
      tinggi_badan_cm: updatedUser.tinggi_badan_cm ? Number(updatedUser.tinggi_badan_cm) : null,
    },
    nutrition_target: newNutritionTarget
      ? {
          id: newNutritionTarget.id,
          kalori_target: newNutritionTarget.kalori_target,
          protein_target_g: Number(newNutritionTarget.protein_target_g),
          karbohidrat_target_g: Number(newNutritionTarget.karbohidrat_target_g),
          lemak_target_g: Number(newNutritionTarget.lemak_target_g),
          zat_besi_target_mg: Number(newNutritionTarget.zat_besi_target_mg),
          berlaku_sejak: newNutritionTarget.berlaku_sejak.toISOString().split("T")[0],
        }
      : null,
  });
}
