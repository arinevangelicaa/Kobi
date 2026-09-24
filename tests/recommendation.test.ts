import { describe, expect, it } from "vitest";

import {
  apakahWarungBuka,
  dapatkanRekomendasiMenu,
  hitungJarakHaversine,
  hitungWaktuTempuhMenit,
  type MenuItemInfo,
  type VendorInfo,
} from "@/lib/services/recommendation";

// Mock data warung dekat DTETI UGM (-7.7667, 110.3774)
const mockVendors: VendorInfo[] = [
  {
    id: "v1",
    nama_warung: "Warmindo Pamungkas",
    latitude: -7.7634,
    longitude: 110.3736,
    jam_buka: "00:00",
    jam_tutup: "23:59",
  },
  {
    id: "v2",
    nama_warung: "Ayam Goreng Ninit",
    latitude: -7.7632,
    longitude: 110.3734,
    jam_buka: "09:00",
    jam_tutup: "17:00",
  },
  {
    id: "v3",
    nama_warung: "Warung Malam Pogung",
    latitude: -7.7638,
    longitude: 110.3743,
    jam_buka: "18:00",
    jam_tutup: "02:00",
  },
  {
    id: "v-jauh",
    nama_warung: "Warung Luar Kota",
    latitude: -7.85,
    longitude: 110.45,
    jam_buka: "08:00",
    jam_tutup: "21:00",
  },
];

const mockMenuItems: MenuItemInfo[] = [
  {
    id: "m1",
    vendor_id: "v1",
    nama_menu: "Orak Arik Telur",
    estimasi_harga: 10000,
    estimasi_protein_g: 12,
    tersedia: true,
  },
  {
    id: "m2",
    vendor_id: "v1",
    nama_menu: "Nasi Goreng Spesial",
    estimasi_harga: 25000, // Mahal
    estimasi_protein_g: 15,
    tersedia: true,
  },
  {
    id: "m3",
    vendor_id: "v2",
    nama_menu: "Nasi Ayam Bakar",
    estimasi_harga: 18000,
    estimasi_protein_g: 24, // Protein tinggi
    tersedia: true,
  },
  {
    id: "m4",
    vendor_id: "v2",
    nama_menu: "Nasi Lele Goreng (Habis)",
    estimasi_harga: 16000,
    estimasi_protein_g: 18,
    tersedia: false, // Tidak tersedia
  },
  {
    id: "m5",
    vendor_id: "v3",
    nama_menu: "Nasi Telur Dadar Malam",
    estimasi_harga: 12000,
    estimasi_protein_g: 13,
    tersedia: true,
  },
  {
    id: "m6",
    vendor_id: "v-jauh",
    nama_menu: "Menu Warung Jauh",
    estimasi_harga: 12000,
    estimasi_protein_g: 15,
    tersedia: true,
  },
];

const lokasiUGM = { latitude: -7.7667, longitude: 110.3774 };

describe("hitungJarakHaversine", () => {
  it("mengembalikan 0 untuk titik yang persis sama", () => {
    const titik = { latitude: -7.7667, longitude: 110.3774 };
    expect(hitungJarakHaversine(titik, titik)).toBe(0);
  });

  it("menghitung jarak perkiraan dengan benar antar koordinat sekitar kampus", () => {
    const dteti = { latitude: -7.7667, longitude: 110.3774 };
    const warmindo = { latitude: -7.7634, longitude: 110.3736 };
    const jarak = hitungJarakHaversine(dteti, warmindo);

    // Sekitar 500 sampai 700 meter
    expect(jarak).toBeGreaterThan(400);
    expect(jarak).toBeLessThan(750);
  });
});

describe("apakahWarungBuka", () => {
  it("mengembalikan true untuk warung 24 jam", () => {
    const siang = new Date("2026-09-24T13:00:00");
    expect(apakahWarungBuka("00:00", "23:59", siang)).toBe(true);
  });

  it("mengecek jam operasional normal", () => {
    const siang = new Date("2026-09-24T12:00:00");
    const malam = new Date("2026-09-24T20:00:00");

    expect(apakahWarungBuka("09:00", "17:00", siang)).toBe(true);
    expect(apakahWarungBuka("09:00", "17:00", malam)).toBe(false);
  });

  it("mengecek jam operasional melewati tengah malam", () => {
    const malam = new Date("2026-09-24T23:30:00");
    const diniHari = new Date("2026-09-24T01:30:00");
    const pagi = new Date("2026-09-24T08:00:00");

    expect(apakahWarungBuka("18:00", "02:00", malam)).toBe(true);
    expect(apakahWarungBuka("18:00", "02:00", diniHari)).toBe(true);
    expect(apakahWarungBuka("18:00", "02:00", pagi)).toBe(false);
  });

  it("mengembalikan true jika jam tidak terdata", () => {
    expect(apakahWarungBuka(null, null)).toBe(true);
  });
});

describe("hitungWaktuTempuhMenit", () => {
  it("menghitung estimasi waktu tempuh secara proporsional", () => {
    // 1500m pada 15 km/jam = 0.1 jam = 6 menit
    expect(hitungWaktuTempuhMenit(1500, 15)).toBe(6);
    expect(hitungWaktuTempuhMenit(0)).toBe(0);
  });
});

describe("dapatkanRekomendasiMenu", () => {
  it("menyaring menu di atas batas anggaran", () => {
    const hasil = dapatkanRekomendasiMenu(mockVendors, mockMenuItems, {
      lokasiPengguna: lokasiUGM,
      batas_anggaran: 15000, // m2 (Rp25.000) dan m3 (Rp18.000) harus tersaring keluar
      sela_waktu_menit: 60,
      waktuSekarang: new Date("2026-09-24T12:00:00"),
    });

    const ids = hasil.map((h) => h.menu_item_id);
    expect(ids).not.toContain("m2");
    expect(ids).not.toContain("m3");
    expect(ids).toContain("m1");
  });

  it("menyaring menu yang tidak tersedia (habis)", () => {
    const hasil = dapatkanRekomendasiMenu(mockVendors, mockMenuItems, {
      lokasiPengguna: lokasiUGM,
      batas_anggaran: 30000,
      sela_waktu_menit: 60,
      waktuSekarang: new Date("2026-09-24T12:00:00"),
    });

    const ids = hasil.map((h) => h.menu_item_id);
    expect(ids).not.toContain("m4"); // m4 tersedia: false
  });

  it("menyaring warung yang sedang tutup", () => {
    // Pada jam 12:00 siang, Warung Malam (v3) tutup
    const hasilSiang = dapatkanRekomendasiMenu(mockVendors, mockMenuItems, {
      lokasiPengguna: lokasiUGM,
      batas_anggaran: 30000,
      sela_waktu_menit: 60,
      waktuSekarang: new Date("2026-09-24T12:00:00"),
    });

    const idsSiang = hasilSiang.map((h) => h.menu_item_id);
    expect(idsSiang).not.toContain("m5"); // Milik v3

    // Pada jam 21:00 malam, v2 tutup, v3 buka
    const hasilMalam = dapatkanRekomendasiMenu(mockVendors, mockMenuItems, {
      lokasiPengguna: lokasiUGM,
      batas_anggaran: 30000,
      sela_waktu_menit: 60,
      waktuSekarang: new Date("2026-09-24T21:00:00"),
    });

    const idsMalam = hasilMalam.map((h) => h.menu_item_id);
    expect(idsMalam).not.toContain("m3"); // Milik v2
    expect(idsMalam).toContain("m5"); // Milik v3
  });

  it("menyaring warung yang waktu tempuhnya melebihi sela waktu kuliah", () => {
    const hasil = dapatkanRekomendasiMenu(mockVendors, mockMenuItems, {
      lokasiPengguna: lokasiUGM,
      batas_anggaran: 30000,
      sela_waktu_menit: 45, // Hanya cukup untuk warung dekat
      waktuSekarang: new Date("2026-09-24T12:00:00"),
    });

    const ids = hasil.map((h) => h.menu_item_id);
    expect(ids).not.toContain("m6"); // Warung Luar Kota (v-jauh)
  });

  it("memberi peringkat lebih tinggi untuk menu dengan protein tinggi dan harga hemat", () => {
    const hasil = dapatkanRekomendasiMenu(mockVendors, mockMenuItems, {
      lokasiPengguna: lokasiUGM,
      batas_anggaran: 20000,
      sela_waktu_menit: 60,
      waktuSekarang: new Date("2026-09-24T12:00:00"),
      kesenjanganGizi: [
        {
          zat: "protein_g",
          target: 60,
          asupan: 20,
          kurang: 40,
          rasio: 0.33,
        },
      ],
    });

    expect(hasil.length).toBeGreaterThan(0);
    // Menu harus terurut berdasarkan skor menurun
    for (let i = 0; i < hasil.length - 1; i++) {
      expect(hasil[i]!.skor).toBeGreaterThanOrEqual(hasil[i + 1]!.skor);
    }

    // Menu dengan protein tertinggi (Nasi Ayam Bakar - 24g protein) menempati peringkat teratas
    expect(hasil[0]?.nama_menu).toBe("Nasi Ayam Bakar");
    expect(hasil[0]?.nama_warung).toBe("Ayam Goreng Ninit");
    expect(hasil[0]?.alasan).toContain("Ayam Goreng Ninit");
    expect(hasil[1]?.nama_warung).toBe("Warmindo Pamungkas");
  });
});
