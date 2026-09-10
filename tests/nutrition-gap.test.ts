import { describe, expect, it } from "vitest";

import {
  hitungKesenjangan,
  jumlahkanAsupan,
  kalimatKesenjangan,
  kesenjanganTeratas,
  type AsupanHarian,
  type TargetHarian,
} from "@/lib/services/nutrition-gap";

const target: TargetHarian = {
  protein_g: 60,
  karbohidrat_g: 300,
  lemak_g: 70,
  zat_besi_mg: 15,
  kalori: 2200,
};

const kosong: AsupanHarian = {
  protein_g: 0,
  karbohidrat_g: 0,
  lemak_g: 0,
  zat_besi_mg: 0,
  kalori: 0,
};

describe("jumlahkanAsupan", () => {
  it("mengembalikan nol untuk hari tanpa catatan makan", () => {
    expect(jumlahkanAsupan([])).toEqual(kosong);
  });

  it("menjumlahkan beberapa catatan makan", () => {
    const hasil = jumlahkanAsupan([
      { protein_g: 14.5, karbohidrat_g: 78, lemak_g: 15.2, zat_besi_mg: 2.1, kalori_estimasi: 520 },
      { protein_g: 20, karbohidrat_g: 60, lemak_g: 10, zat_besi_mg: 3, kalori_estimasi: 430 },
    ]);

    expect(hasil.protein_g).toBeCloseTo(34.5);
    expect(hasil.karbohidrat_g).toBeCloseTo(138);
    expect(hasil.kalori).toBe(950);
  });
});

describe("hitungKesenjangan", () => {
  it("mengurutkan zat gizi dari yang paling kurang terpenuhi", () => {
    const hasil = hitungKesenjangan(target, {
      ...kosong,
      protein_g: 6, // 10 persen
      karbohidrat_g: 240, // 80 persen
      lemak_g: 35, // 50 persen
      zat_besi_mg: 15, // penuh
    });

    expect(hasil.map((g) => g.zat)).toEqual([
      "protein_g",
      "lemak_g",
      "karbohidrat_g",
      "zat_besi_mg",
    ]);
  });

  it("tidak pernah melaporkan kekurangan negatif saat asupan melampaui target", () => {
    const hasil = hitungKesenjangan(target, { ...kosong, protein_g: 90 });
    const protein = hasil.find((g) => g.zat === "protein_g");

    expect(protein?.kurang).toBe(0);
    expect(protein?.rasio).toBe(1);
  });

  it("tidak membagi nol ketika target belum diisi", () => {
    const tanpaTarget: TargetHarian = { ...target, zat_besi_mg: 0 };
    const besi = hitungKesenjangan(tanpaTarget, kosong).find((g) => g.zat === "zat_besi_mg");

    expect(besi?.rasio).toBe(1);
    expect(besi?.kurang).toBe(0);
  });
});

describe("kesenjanganTeratas", () => {
  it("hanya mengembalikan zat gizi yang masih kurang", () => {
    const hasil = kesenjanganTeratas(target, {
      ...kosong,
      protein_g: 10,
      karbohidrat_g: 300,
      lemak_g: 70,
      zat_besi_mg: 15,
    });

    expect(hasil).toHaveLength(1);
    expect(hasil[0]?.zat).toBe("protein_g");
  });

  it("membatasi jumlah yang ditampilkan", () => {
    expect(kesenjanganTeratas(target, kosong, 2)).toHaveLength(2);
  });
});

describe("kalimatKesenjangan", () => {
  it("menyebut sisa kebutuhan dalam bahasa sederhana", () => {
    const gap = hitungKesenjangan(target, { ...kosong, protein_g: 40 }).find(
      (g) => g.zat === "protein_g",
    );

    expect(kalimatKesenjangan(gap!)).toBe("Protein masih kurang sekitar 20 gram hari ini.");
  });

  it("menyatakan tercukupi tanpa angka saat target terpenuhi", () => {
    const gap = hitungKesenjangan(target, { ...kosong, protein_g: 60 }).find(
      (g) => g.zat === "protein_g",
    );

    expect(kalimatKesenjangan(gap!)).toBe("Protein hari ini sudah tercukupi.");
  });
});
