import { describe, expect, it } from "vitest";

import { hitungTargetGizi, hitungUsia } from "@/lib/services/nutrition-target";

describe("hitungUsia", () => {
  it("menghitung usia dengan benar berdasarkan tanggal lahir", () => {
    const acuan = new Date("2026-10-09");
    const tglLahir = "2004-05-15"; // Usia 22 tahun pada Oktober 2026
    expect(hitungUsia(tglLahir, acuan)).toBe(22);
  });

  it("mengembalikan default 20 tahun jika tanggal lahir tidak diisi", () => {
    expect(hitungUsia(null)).toBe(20);
    expect(hitungUsia(undefined)).toBe(20);
  });
});

describe("hitungTargetGizi", () => {
  it("menghitung target gizi untuk mahasiswa pria secara proporsional", () => {
    const target = hitungTargetGizi({
      jenis_kelamin: "L",
      berat_badan_kg: 65,
      tinggi_badan_cm: 170,
      tanggal_lahir: "2005-01-01",
    });

    expect(target.kalori_target).toBeGreaterThan(1800);
    expect(target.kalori_target).toBeLessThan(2600);
    expect(target.protein_target_g).toBeGreaterThanOrEqual(78);
    expect(target.zat_besi_target_mg).toBe(11);
  });

  it("menghitung target gizi untuk mahasiswi wanita dengan kebutuhan zat besi lebih tinggi", () => {
    const target = hitungTargetGizi({
      jenis_kelamin: "P",
      berat_badan_kg: 50,
      tinggi_badan_cm: 158,
      tanggal_lahir: "2005-01-01",
    });

    expect(target.kalori_target).toBeGreaterThan(1500);
    expect(target.kalori_target).toBeLessThan(2200);
    expect(target.zat_besi_target_mg).toBe(18); // AKG zat besi wanita
  });

  it("menangani profil kosong dengan nilai default mahasiswa wajar", () => {
    const target = hitungTargetGizi({});
    expect(target.kalori_target).toBeGreaterThan(1700);
    expect(target.protein_target_g).toBeGreaterThan(50);
  });
});
