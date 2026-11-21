import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  formatRingkasan,
  galatBertanda,
  galatRelatif,
  hitungMetrik,
  hitungSebaranKeyakinan,
  parseCsvAcuan,
  type BarisAcuan,
  type HasilBaris,
} from "@/scripts/eval-metrics";

function acuan(teks: string, kalori: number, protein: number, karbo = 50, lemak = 10, besi = 2): BarisAcuan {
  return { teks_input: teks, kalori, protein_g: protein, karbohidrat_g: karbo, lemak_g: lemak, zat_besi_mg: besi };
}

function hasil(a: BarisAcuan, delta: Partial<Record<string, number>> = {}, keyakinan = 0.8): HasilBaris {
  return {
    acuan: a,
    estimasi: {
      kalori: a.kalori + (delta.kalori ?? 0),
      protein_g: a.protein_g + (delta.protein_g ?? 0),
      karbohidrat_g: a.karbohidrat_g + (delta.karbohidrat_g ?? 0),
      lemak_g: a.lemak_g + (delta.lemak_g ?? 0),
      zat_besi_mg: a.zat_besi_mg + (delta.zat_besi_mg ?? 0),
      tingkat_keyakinan: keyakinan,
    },
  };
}

describe("galatRelatif", () => {
  it("menghitung selisih mutlak terhadap acuan", () => {
    expect(galatRelatif(120, 100)).toBeCloseTo(0.2);
    expect(galatRelatif(80, 100)).toBeCloseTo(0.2);
    expect(galatRelatif(100, 100)).toBe(0);
  });

  it("null bila acuan 0 atau tidak valid", () => {
    expect(galatRelatif(5, 0)).toBeNull();
    expect(galatRelatif(Number.NaN, 10)).toBeNull();
    expect(galatRelatif(5, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("galatBertanda positif bila melebihkan, negatif bila mengurangi", () => {
    expect(galatBertanda(150, 100)).toBeCloseTo(0.5);
    expect(galatBertanda(50, 100)).toBeCloseTo(-0.5);
    expect(galatBertanda(1, 0)).toBeNull();
  });
});

describe("hitungMetrik", () => {
  it("menghitung MAPE, median, bias, dan proporsi dalam ambang", () => {
    const data = [
      hasil(acuan("a", 100, 10), { kalori: 10 }), // +10%
      hasil(acuan("b", 100, 10), { kalori: -30 }), // -30%
      hasil(acuan("c", 100, 10), { kalori: 60 }), // +60%
      hasil(acuan("d", 100, 10), { kalori: 0 }), // 0%
    ];

    const m = hitungMetrik(data).per_zat.kalori;

    expect(m.n).toBe(4);
    expect(m.galat_rata_rata).toBeCloseTo((0.1 + 0.3 + 0.6 + 0) / 4);
    expect(m.galat_median).toBeCloseTo((0.1 + 0.3) / 2);
    expect(m.bias_rata_rata).toBeCloseTo((0.1 - 0.3 + 0.6 + 0) / 4);
    expect(m.dalam_25_persen).toBeCloseTo(2 / 4); // 10% dan 0%
    expect(m.dalam_50_persen).toBeCloseTo(3 / 4);
  });

  it("median untuk jumlah ganjil memakai nilai tengah", () => {
    const data = [
      hasil(acuan("a", 100, 10), { kalori: 10 }),
      hasil(acuan("b", 100, 10), { kalori: 50 }),
      hasil(acuan("c", 100, 10), { kalori: 20 }),
    ];

    expect(hitungMetrik(data).per_zat.kalori.galat_median).toBeCloseTo(0.2);
  });

  it("acuan 0 dikecualikan dari galat relatif dan dicatat terpisah", () => {
    const data = [
      hasil(acuan("es teh", 90, 0), { protein_g: 1 }),
      hasil(acuan("nasi", 300, 6), { protein_g: 3 }), // 50%
    ];

    const protein = hitungMetrik(data).per_zat.protein_g;

    expect(protein.n).toBe(1);
    expect(protein.dikecualikan_acuan_nol).toBe(1);
    expect(protein.galat_rata_rata).toBeCloseTo(0.5);
  });

  it("baris tanpa estimasi dihitung gagal dan tidak ikut galat", () => {
    const data: HasilBaris[] = [hasil(acuan("a", 100, 10), { kalori: 20 }), { acuan: acuan("b", 100, 10), estimasi: null }];

    const m = hitungMetrik(data);

    expect(m.jumlah_baris).toBe(2);
    expect(m.jumlah_berhasil).toBe(1);
    expect(m.jumlah_tanpa_estimasi).toBe(1);
    expect(m.per_zat.kalori.n).toBe(1);
  });

  it("data kosong tidak membagi dengan nol", () => {
    const m = hitungMetrik([]);

    expect(m.jumlah_baris).toBe(0);
    expect(m.per_zat.kalori.galat_rata_rata).toBeNull();
    expect(m.per_zat.kalori.dalam_25_persen).toBeNull();
    expect(m.keyakinan.rata_rata).toBeNull();
  });

  it("semua baris gagal: semua metrik null, tidak throw", () => {
    const m = hitungMetrik([{ acuan: acuan("a", 100, 10), estimasi: null }]);

    expect(m.jumlah_tanpa_estimasi).toBe(1);
    expect(m.per_zat.zat_besi_mg.n).toBe(0);
  });
});

describe("hitungSebaranKeyakinan", () => {
  it("membagi ke rendah (<0,4), sedang, dan tinggi (>=0,7) dengan batas yang benar", () => {
    const s = hitungSebaranKeyakinan([0.1, 0.39, 0.4, 0.69, 0.7, 0.95]);

    expect(s).toMatchObject({ rendah: 2, sedang: 2, tinggi: 2 });
    expect(s.rata_rata).toBeCloseTo((0.1 + 0.39 + 0.4 + 0.69 + 0.7 + 0.95) / 6);
  });
});

describe("parseCsvAcuan", () => {
  it("mengabaikan komentar dan baris kosong, mengurai angka", () => {
    const csv = "# komentar\n\nteks_input,kalori,protein_g,karbohidrat_g,lemak_g,zat_besi_mg\nnasi telur,500,15,60,20,2.5\n";

    expect(parseCsvAcuan(csv)).toEqual([
      { teks_input: "nasi telur", kalori: 500, protein_g: 15, karbohidrat_g: 60, lemak_g: 20, zat_besi_mg: 2.5 },
    ]);
  });

  it("mendukung teks_input berkutip yang memuat koma", () => {
    const csv = 'teks_input,kalori,protein_g,karbohidrat_g,lemak_g,zat_besi_mg\n"nasi, telur, tempe",500,15,60,20,2\n';

    expect(parseCsvAcuan(csv)[0]?.teks_input).toBe("nasi, telur, tempe");
  });

  it("melempar galat jelas untuk kolom hilang, angka rusak, dan CSV kosong", () => {
    expect(() => parseCsvAcuan("teks_input,kalori\nnasi,500")).toThrow(/Kolom "protein_g"/);
    expect(() =>
      parseCsvAcuan("teks_input,kalori,protein_g,karbohidrat_g,lemak_g,zat_besi_mg\nnasi,abc,1,1,1,1"),
    ).toThrow(/kalori/);
    expect(() =>
      parseCsvAcuan("teks_input,kalori,protein_g,karbohidrat_g,lemak_g,zat_besi_mg\nnasi,-5,1,1,1,1"),
    ).toThrow(/kalori/);
    expect(() => parseCsvAcuan("# saja")).toThrow(/kosong/);
  });

  it("docs/eval-estimasi.csv valid, 30-40 baris, tanpa teks ganda", () => {
    const isi = readFileSync(path.resolve(__dirname, "../docs/eval-estimasi.csv"), "utf8");

    const baris = parseCsvAcuan(isi);

    expect(baris.length).toBeGreaterThanOrEqual(30);
    expect(baris.length).toBeLessThanOrEqual(40);
    expect(new Set(baris.map((b) => b.teks_input)).size).toBe(baris.length);
    expect(isi).toMatch(/ACUAN KASAR/);
  });
});

describe("formatRingkasan", () => {
  it("memuat jumlah baris, tiap zat, sebaran keyakinan, dan catatan acuan kasar", () => {
    const teks = formatRingkasan(hitungMetrik([hasil(acuan("a", 100, 10), { kalori: 10 })]));

    expect(teks).toContain("Baris dievaluasi : 1");
    for (const z of ["kalori", "protein_g", "karbohidrat_g", "lemak_g", "zat_besi_mg"]) {
      expect(teks).toContain(z);
    }
    expect(teks).toContain("tingkat_keyakinan");
    expect(teks).toMatch(/acuan kasar/);
  });
});
