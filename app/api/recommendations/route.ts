import { NextResponse } from "next/server";

import { hitungJarakWaktuBanyakTujuan } from "@/lib/azure/maps";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dateKeJamStr } from "@/lib/db-time";
import { hitungKesenjangan, jumlahkanAsupan, type EstimasiGizi, type Kesenjangan } from "@/lib/services/nutrition-gap";
import {
  apakahWarungBuka,
  dapatkanRekomendasiMenu,
  type MenuItemInfo,
  type VendorInfo,
} from "@/lib/services/recommendation";
import { recommendationQuerySchema } from "@/lib/validation/recommendation";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = recommendationQuerySchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Input parameter rekomendasi tidak valid.",
    );
  }

  const data = parsed.data;
  const session = await auth();
  const userId = session?.user?.id;

  // Hitung kesenjangan gizi harian pengguna jika login
  let kesenjanganGizi: Kesenjangan[] | undefined;

  if (userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [targetDb, mealsDb] = await Promise.all([
      prisma.nutritionTarget.findFirst({
        where: { user_id: userId },
        orderBy: { berlaku_sejak: "desc" },
      }),
      prisma.mealLog.findMany({
        where: {
          user_id: userId,
          waktu_makan: { gte: today },
        },
        include: {
          nutrition_estimate: true,
        },
      }),
    ]);

    if (targetDb) {
      const estimasiList: EstimasiGizi[] = [];
      for (const meal of mealsDb) {
        if (meal.nutrition_estimate) {
          estimasiList.push({
            protein_g: Number(meal.nutrition_estimate.protein_g),
            karbohidrat_g: Number(meal.nutrition_estimate.karbohidrat_g),
            lemak_g: Number(meal.nutrition_estimate.lemak_g),
            zat_besi_mg: Number(meal.nutrition_estimate.zat_besi_mg),
            kalori_estimasi: meal.nutrition_estimate.kalori_estimasi,
          });
        }
      }

      const asupan = jumlahkanAsupan(estimasiList);
      kesenjanganGizi = hitungKesenjangan(
        {
          protein_g: Number(targetDb.protein_target_g),
          karbohidrat_g: Number(targetDb.karbohidrat_target_g),
          lemak_g: Number(targetDb.lemak_target_g),
          zat_besi_mg: Number(targetDb.zat_besi_target_mg),
          kalori: targetDb.kalori_target,
        },
        asupan,
      );
    }
  }

  // Ambil semua vendor dan menu aktif dari basis data
  const vendorsFromDb = await prisma.vendor.findMany({
    include: {
      menu_items: {
        where: { tersedia: true },
      },
    },
  });

  const vendors: VendorInfo[] = [];
  const menuItems: MenuItemInfo[] = [];

  for (const v of vendorsFromDb) {
    if (v.latitude === null || v.longitude === null) continue;

    vendors.push({
      id: v.id,
      nama_warung: v.nama_warung,
      jenis_vendor: v.jenis_vendor,
      alamat: v.alamat,
      latitude: Number(v.latitude),
      longitude: Number(v.longitude),
      jam_buka: dateKeJamStr(v.jam_buka),
      jam_tutup: dateKeJamStr(v.jam_tutup),
    });

    for (const m of v.menu_items) {
      menuItems.push({
        id: m.id,
        vendor_id: m.vendor_id,
        nama_menu: m.nama_menu,
        estimasi_harga: m.estimasi_harga,
        estimasi_kalori: m.estimasi_kalori,
        estimasi_protein_g: m.estimasi_protein_g ? Number(m.estimasi_protein_g) : null,
        tersedia: m.tersedia,
      });
    }
  }

  const lokasiPengguna = { latitude: data.latitude, longitude: data.longitude };
  const waktuSekarang = data.waktu ? new Date(data.waktu) : new Date();

  // Azure Maps (docs/architecture.md bagian 11 langkah 1-3): panggil hanya
  // untuk vendor yang sedang buka, satu kali permintaan untuk semuanya
  // sekaligus (bukan satu per vendor) supaya hemat kuota.
  const vendorBuka = vendors.filter((v) => apakahWarungBuka(v.jam_buka, v.jam_tutup, waktuSekarang));
  const jarakAktual = await hitungJarakWaktuBanyakTujuan(
    lokasiPengguna,
    vendorBuka.map((v) => ({ id: v.id, latitude: v.latitude, longitude: v.longitude })),
  );

  const rekomendasi = dapatkanRekomendasiMenu(
    vendors,
    menuItems,
    {
      lokasiPengguna,
      batas_anggaran: data.batas_anggaran,
      sela_waktu_menit: data.sela_waktu_menit,
      waktuSekarang,
      kesenjanganGizi,
      kecepatanTempuhKmJam: data.kecepatan_km_jam ?? 15,
      durasiMakanMenit: data.durasi_makan_menit ?? 25,
      jarakAktual,
    },
    data.jumlah,
  );

  // Simpan riwayat rekomendasi jika pengguna terotentikasi
  if (userId && rekomendasi.length > 0) {
    try {
      await prisma.recommendation.createMany({
        data: rekomendasi.map((r) => ({
          user_id: userId,
          menu_item_id: r.menu_item_id,
          vendor_id: r.vendor_id,
          gizi_disasar: r.gizi_disasar,
          batas_anggaran: data.batas_anggaran,
          sela_waktu_menit: data.sela_waktu_menit,
          jarak_meter: r.jarak_meter,
          status: "ditampilkan",
        })),
      });
    } catch (e) {
      // Gagal simpan log rekomendasi tidak boleh membatalkan hasil respons ke pengguna
      console.warn("Gagal menyimpan riwayat rekomendasi ke basis data:", e);
    }
  }

  return NextResponse.json({
    success: true,
    count: rekomendasi.length,
    recommendations: rekomendasi,
  });
}
