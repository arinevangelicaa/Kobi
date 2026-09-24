/**
 * F4 - Logika Rekomendasi Menu Warung Terdekat.
 *
 * Mengimplementasikan algoritma rekomendasi berjenjang sesuai docs/architecture.md bagian 11.
 * Modul ini berupa fungsi-fungsi murni (pure functions) yang tidak bergantung langsung
 * pada Prisma atau pemanggilan HTTP jaringan, sehingga dapat diuji secara independen.
 */

import type { Kesenjangan } from "./nutrition-gap";

export interface Koordinat {
  latitude: number;
  longitude: number;
}

export interface VendorInfo {
  id: string;
  nama_warung: string;
  jenis_vendor?: string | null;
  alamat?: string | null;
  latitude: number;
  longitude: number;
  jam_buka?: string | null; // format "HH:MM" misal "08:00"
  jam_tutup?: string | null; // format "HH:MM" misal "21:00"
}

export interface MenuItemInfo {
  id: string;
  vendor_id: string;
  nama_menu: string;
  estimasi_harga: number;
  estimasi_kalori?: number | null;
  estimasi_protein_g?: number | null;
  tersedia: boolean;
}

export interface KriteriaRekomendasi {
  lokasiPengguna: Koordinat;
  batas_anggaran: number; // Rupiah
  sela_waktu_menit: number; // Menit waktu luang
  waktuSekarang?: Date; // Waktu saat meminta rekomendasi (default: now)
  kesenjanganGizi?: readonly Kesenjangan[]; // Hasil hitung dari nutrition-gap.ts
  kecepatanTempuhKmJam?: number; // Rata-rata mobilitas (default 15 km/jam untuk area kampus)
  durasiMakanMenit?: number; // Estimasi waktu pesan + santap (default 25 menit)
}

export interface RekomendasiMenu {
  menu_item_id: string;
  vendor_id: string;
  nama_warung: string;
  nama_menu: string;
  estimasi_harga: number;
  estimasi_protein_g: number;
  jarak_meter: number;
  waktu_tempuh_satu_arah_menit: number;
  total_waktu_dibutuhkan_menit: number;
  skor: number;
  gizi_disasar: string;
  alasan: string;
}

/**
 * Bobot skoring transparan sesuai docs/architecture.md bagian 11 langkah 6:
 * - Gizi: seberapa besar menutup kesenjangan gizi (terutama protein)
 * - Jarak: kedekatan lokasi warung dengan pengguna
 * - Anggaran: efisiensi sisa anggaran
 */
export const BOBOT_REKOMENDASI = {
  gizi: 0.5,
  jarak: 0.25,
  anggaran: 0.25,
} as const;

/** Jari-jari bumi dalam meter */
const EARTH_RADIUS_METERS = 6371000;

/**
 * Menghitung jarak garis lurus antara dua titik koordinat (formula Haversine).
 * Digunakan sebagai penyaring lokasi awal dan fallback bila layanan peta tidak tersedia.
 */
export function hitungJarakHaversine(titikA: Koordinat, titikB: Koordinat): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(titikB.latitude - titikA.latitude);
  const dLon = rad(titikB.longitude - titikA.longitude);

  const lat1 = rad(titikA.latitude);
  const lat2 = rad(titikB.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Mengonversi string waktu "HH:MM" menjadi menit sejak tengah malam (0..1439).
 */
export function menitSejakTengahMalam(jamStr: string): number {
  const parts = jamStr.split(":");
  const jam = parseInt(parts[0] ?? "0", 10);
  const menit = parseInt(parts[1] ?? "0", 10);
  return jam * 60 + menit;
}

/**
 * Memeriksa apakah warung buka pada waktu tertentu.
 * Menangani kasus:
 * 1. Jam buka dan tutup kosong -> dianggap buka (informal)
 * 2. Buka 24 jam (misal 00:00 - 23:59 atau jam_buka == jam_tutup)
 * 3. Jam operasional normal (misal 08:00 - 21:00)
 * 4. Jam operasional melewati tengah malam (misal 17:00 - 02:00)
 */
export function apakahWarungBuka(
  jamBuka?: string | null,
  jamTutup?: string | null,
  waktu: Date = new Date(),
): boolean {
  if (!jamBuka || !jamTutup) {
    return true; // Jika data jam tidak ada, jangan langsung buang
  }

  const buka = menitSejakTengahMalam(jamBuka);
  const tutup = menitSejakTengahMalam(jamTutup);
  const sekarang = waktu.getHours() * 60 + waktu.getMinutes();

  // Buka 24 jam atau hampir 24 jam (misal 00:00 s.d 23:59)
  if (buka === tutup || (buka === 0 && tutup >= 1430)) {
    return true;
  }

  if (buka < tutup) {
    // Operasional dalam hari yang sama
    return sekarang >= buka && sekarang <= tutup;
  } else {
    // Operasional melewati tengah malam (misal 17:00 sampai 03:00)
    return sekarang >= buka || sekarang <= tutup;
  }
}

/**
 * Menghitung waktu tempuh satu arah dalam menit berdasarkan jarak meter dan kecepatan km/jam.
 */
export function hitungWaktuTempuhMenit(jarakMeter: number, kecepatanKmJam = 15): number {
  if (jarakMeter <= 0) return 0;
  const jarakKm = jarakMeter / 1000;
  const jam = jarakKm / kecepatanKmJam;
  return Math.ceil(jam * 60);
}

/**
 * Menyusun kalimat penjelasan alasan rekomendasi menu.
 */
export function buatKalimatAlasan(
  namaMenu: string,
  namaWarung: string,
  jarakMeter: number,
  proteinG: number,
  harga: number,
): string {
  const jarakStr = jarakMeter < 1000 ? `${jarakMeter} m` : `${(jarakMeter / 1000).toFixed(1)} km`;
  const infoGizi = proteinG > 0 ? `mengandung ~${proteinG}g protein` : "menu bergizi seimbang";
  return `${namaMenu} di ${namaWarung} (${jarakStr}, Rp${harga.toLocaleString("id-ID")}) membantu menutup kebutuhan protein harianmu dengan ${infoGizi}.`;
}

/**
 * Algoritma Utama: Menyaring dan memberi skor kandidat menu warung terdekat.
 */
export function dapatkanRekomendasiMenu(
  vendors: readonly VendorInfo[],
  menuItems: readonly MenuItemInfo[],
  kriteria: KriteriaRekomendasi,
  jumlahRekomendasi = 5,
): RekomendasiMenu[] {
  const waktuSekarang = kriteria.waktuSekarang ?? new Date();
  const kecepatan = kriteria.kecepatanTempuhKmJam ?? 15;
  const durasiMakan = kriteria.durasiMakanMenit ?? 25;

  // 1. Tentukan zat gizi utama yang paling dibutuhkan (prioritas protein)
  const gapProtein = kriteria.kesenjanganGizi?.find((g) => g.zat === "protein_g");
  const kekuranganProtein = gapProtein ? gapProtein.kurang : 20; // Default target jika belum ada data

  // Peta vendor berdasarkan ID untuk lookup cepat
  const vendorMap = new Map<string, VendorInfo>();
  for (const v of vendors) {
    vendorMap.set(v.id, v);
  }

  // 2. Tahap Eliminasi & Penyaringan
  const kandidatMenu: Array<{
    menu: MenuItemInfo;
    vendor: VendorInfo;
    jarakMeter: number;
    waktuTempuhSatuArah: number;
    totalWaktu: number;
  }> = [];

  for (const menu of menuItems) {
    // Saring ketersediaan menu
    if (!menu.tersedia) continue;

    // Saring batas anggaran
    if (menu.estimasi_harga > kriteria.batas_anggaran) continue;

    const vendor = vendorMap.get(menu.vendor_id);
    if (!vendor) continue;

    // Saring jam operasional warung
    if (!apakahWarungBuka(vendor.jam_buka, vendor.jam_tutup, waktuSekarang)) {
      continue;
    }

    // Saring jarak dan waktu tempuh
    const jarakMeter = hitungJarakHaversine(kriteria.lokasiPengguna, {
      latitude: vendor.latitude,
      longitude: vendor.longitude,
    });

    const waktuTempuhSatuArah = hitungWaktuTempuhMenit(jarakMeter, kecepatan);
    // Waktu pulang pergi + waktu makan
    const totalWaktu = waktuTempuhSatuArah * 2 + durasiMakan;

    // Saring sela waktu kuliah
    if (totalWaktu > kriteria.sela_waktu_menit) {
      continue;
    }

    kandidatMenu.push({
      menu,
      vendor,
      jarakMeter,
      waktuTempuhSatuArah,
      totalWaktu,
    });
  }

  if (kandidatMenu.length === 0) {
    return [];
  }

  // 3. Tahap Normalisasi dan Skoring Multi-Kriteria
  // Cari nilai ekstrem untuk normalisasi skala (0..1)
  const maxJarak = Math.max(...kandidatMenu.map((k) => k.jarakMeter), 1);
  const proteinTarget = Math.max(kekuranganProtein, 1);

  const menuTerskor = kandidatMenu.map((item) => {
    const protein = item.menu.estimasi_protein_g ?? 5; // Asumsi dasar 5g jika belum terdata

    // Skor Gizi: rasio kontribusi protein terhadap kekurangan, dibatasi maks 1.0
    const skorGizi = Math.min(1, protein / proteinTarget);

    // Skor Jarak: semakin dekat semakin tinggi (1 = tepat di lokasi, 0 = jarak terjauh)
    const skorJarak = Math.max(0, 1 - item.jarakMeter / maxJarak);

    // Skor Anggaran: semakin hemat (sisa anggaran lebih banyak), skor semakin tinggi
    const sisaAnggaran = Math.max(0, kriteria.batas_anggaran - item.menu.estimasi_harga);
    const skorAnggaran = kriteria.batas_anggaran > 0 ? sisaAnggaran / kriteria.batas_anggaran : 0;

    // Hitung total skor tertimbang
    const totalSkor =
      BOBOT_REKOMENDASI.gizi * skorGizi +
      BOBOT_REKOMENDASI.jarak * skorJarak +
      BOBOT_REKOMENDASI.anggaran * skorAnggaran;

    return {
      menu_item_id: item.menu.id,
      vendor_id: item.vendor.id,
      nama_warung: item.vendor.nama_warung,
      nama_menu: item.menu.nama_menu,
      estimasi_harga: item.menu.estimasi_harga,
      estimasi_protein_g: protein,
      jarak_meter: item.jarakMeter,
      waktu_tempuh_satu_arah_menit: item.waktuTempuhSatuArah,
      total_waktu_dibutuhkan_menit: item.totalWaktu,
      skor: Math.round(totalSkor * 1000) / 1000,
      gizi_disasar: "protein",
      alasan: buatKalimatAlasan(
        item.menu.nama_menu,
        item.vendor.nama_warung,
        item.jarakMeter,
        protein,
        item.menu.estimasi_harga,
      ),
    };
  });

  // 4. Urutkan berdasarkan skor tertinggi dan batasi jumlah rekomendasi
  return menuTerskor.sort((a, b) => b.skor - a.skor).slice(0, jumlahRekomendasi);
}
