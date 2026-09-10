/**
 * F2 - perhitungan kesenjangan gizi.
 *
 * Lihat docs/architecture.md bagian 10. Modul ini sengaja bebas dari Prisma dan
 * dari pemanggilan jaringan supaya bisa diuji langsung tanpa basis data.
 */

/** Zat gizi yang ditampilkan sebagai kesenjangan. Kalori sengaja tidak masuk. */
export const ZAT_GIZI = ["protein_g", "karbohidrat_g", "lemak_g", "zat_besi_mg"] as const;

export type ZatGizi = (typeof ZAT_GIZI)[number];

export type TargetHarian = Record<ZatGizi, number> & { kalori: number };

export type AsupanHarian = Record<ZatGizi, number> & { kalori: number };

export interface Kesenjangan {
  zat: ZatGizi;
  target: number;
  asupan: number;
  /** Sisa kebutuhan. Nol berarti sudah terpenuhi, tidak pernah negatif. */
  kurang: number;
  /** Bagian target yang sudah terpenuhi, 0..1. */
  rasio: number;
}

export interface EstimasiGizi {
  protein_g: number;
  karbohidrat_g: number;
  lemak_g: number;
  zat_besi_mg: number;
  kalori_estimasi: number;
}

const NOL: AsupanHarian = {
  protein_g: 0,
  karbohidrat_g: 0,
  lemak_g: 0,
  zat_besi_mg: 0,
  kalori: 0,
};

/** Menjumlahkan seluruh estimasi gizi dalam satu hari. */
export function jumlahkanAsupan(estimasi: readonly EstimasiGizi[]): AsupanHarian {
  return estimasi.reduce<AsupanHarian>(
    (total, e) => ({
      protein_g: total.protein_g + e.protein_g,
      karbohidrat_g: total.karbohidrat_g + e.karbohidrat_g,
      lemak_g: total.lemak_g + e.lemak_g,
      zat_besi_mg: total.zat_besi_mg + e.zat_besi_mg,
      kalori: total.kalori + e.kalori_estimasi,
    }),
    { ...NOL },
  );
}

/**
 * Menghitung kesenjangan per zat gizi, diurutkan dari yang paling kurang.
 * Target nol atau negatif dianggap sudah terpenuhi, bukan dibagi nol.
 */
export function hitungKesenjangan(
  target: TargetHarian,
  asupan: AsupanHarian,
): Kesenjangan[] {
  return ZAT_GIZI.map((zat) => {
    const nilaiTarget = target[zat];
    const nilaiAsupan = asupan[zat];
    const kurang = Math.max(0, nilaiTarget - nilaiAsupan);
    const rasio = nilaiTarget > 0 ? Math.min(1, nilaiAsupan / nilaiTarget) : 1;

    return { zat, target: nilaiTarget, asupan: nilaiAsupan, kurang, rasio };
  }).sort((a, b) => a.rasio - b.rasio);
}

const LABEL: Record<ZatGizi, { nama: string; satuan: string }> = {
  protein_g: { nama: "Protein", satuan: "gram" },
  karbohidrat_g: { nama: "Karbohidrat", satuan: "gram" },
  lemak_g: { nama: "Lemak", satuan: "gram" },
  zat_besi_mg: { nama: "Zat besi", satuan: "mg" },
};

/**
 * Menyusun kalimat Bahasa Indonesia untuk satu kesenjangan.
 * Angka dibulatkan karena estimasi memang bukan hasil uji laboratorium.
 */
export function kalimatKesenjangan(gap: Kesenjangan): string {
  const { nama, satuan } = LABEL[gap.zat];
  if (gap.kurang <= 0) {
    return `${nama} hari ini sudah tercukupi.`;
  }
  return `${nama} masih kurang sekitar ${Math.round(gap.kurang)} ${satuan} hari ini.`;
}

/** Mengambil beberapa kesenjangan terbesar untuk ditampilkan di beranda. */
export function kesenjanganTeratas(
  target: TargetHarian,
  asupan: AsupanHarian,
  jumlah = 3,
): Kesenjangan[] {
  return hitungKesenjangan(target, asupan)
    .filter((gap) => gap.kurang > 0)
    .slice(0, jumlah);
}
