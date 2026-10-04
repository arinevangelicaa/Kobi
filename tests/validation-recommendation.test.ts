import { describe, expect, it } from "vitest";

import { recommendationQuerySchema } from "@/lib/validation/recommendation";

describe("recommendationQuerySchema", () => {
  it("menerima parameter rekomendasi yang valid dengan default jumlah 5", () => {
    const hasil = recommendationQuerySchema.parse({
      latitude: -7.76346,
      longitude: 110.37365,
      batas_anggaran: 20000,
      sela_waktu_menit: 45,
    });

    expect(hasil.latitude).toBe(-7.76346);
    expect(hasil.longitude).toBe(110.37365);
    expect(hasil.batas_anggaran).toBe(20000);
    expect(hasil.sela_waktu_menit).toBe(45);
    expect(hasil.jumlah).toBe(5);
  });

  it("menolak koordinat latitude yang berada di luar rentang -90 sampai 90", () => {
    const hasil = recommendationQuerySchema.safeParse({
      latitude: 95.5,
      longitude: 110.37,
      batas_anggaran: 15000,
      sela_waktu_menit: 30,
    });
    expect(hasil.success).toBe(false);
  });

  it("menolak koordinat longitude yang berada di luar rentang -180 sampai 180", () => {
    const hasil = recommendationQuerySchema.safeParse({
      latitude: -7.76,
      longitude: 200.0,
      batas_anggaran: 15000,
      sela_waktu_menit: 30,
    });
    expect(hasil.success).toBe(false);
  });

  it("menolak batas anggaran di bawah Rp1.000", () => {
    const hasil = recommendationQuerySchema.safeParse({
      latitude: -7.76,
      longitude: 110.37,
      batas_anggaran: 500,
      sela_waktu_menit: 30,
    });
    expect(hasil.success).toBe(false);
  });

  it("menolak sela waktu kuliah di bawah 5 menit atau di atas 8 jam", () => {
    const hasilTerlaluKecil = recommendationQuerySchema.safeParse({
      latitude: -7.76,
      longitude: 110.37,
      batas_anggaran: 20000,
      sela_waktu_menit: 2,
    });
    expect(hasilTerlaluKecil.success).toBe(false);

    const hasilTerlaluBesar = recommendationQuerySchema.safeParse({
      latitude: -7.76,
      longitude: 110.37,
      batas_anggaran: 20000,
      sela_waktu_menit: 600,
    });
    expect(hasilTerlaluBesar.success).toBe(false);
  });

  it("menerima opsi waktu ISO datetime dan parameter mobilitas", () => {
    const hasil = recommendationQuerySchema.parse({
      latitude: -7.76,
      longitude: 110.37,
      batas_anggaran: 25000,
      sela_waktu_menit: 60,
      waktu: "2026-10-04T12:30:00.000Z",
      kecepatan_km_jam: 20,
      durasi_makan_menit: 30,
      jumlah: 3,
    });

    expect(hasil.waktu).toBe("2026-10-04T12:30:00.000Z");
    expect(hasil.kecepatan_km_jam).toBe(20);
    expect(hasil.durasi_makan_menit).toBe(30);
    expect(hasil.jumlah).toBe(3);
  });
});
