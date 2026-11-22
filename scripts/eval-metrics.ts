/**
 * Perhitungan metrik evaluasi estimasi gizi (issue #58). Murni: tanpa jaringan,
 * tanpa berkas, tanpa env, supaya bisa diuji unit. Bagian jaringan ada di
 * scripts/eval-estimasi.ts.
 *
 * Galat relatif = |estimasi - acuan| / acuan. Baris dengan acuan 0 (mis. lemak
 * es teh tawar) dikecualikan dari galat relatif zat itu dan dihitung terpisah,
 * karena pembagian dengan nol tidak bermakna.
 */

export const ZAT_EVAL = ["kalori", "protein_g", "karbohidrat_g", "lemak_g", "zat_besi_mg"] as const;
export type ZatEval = (typeof ZAT_EVAL)[number];

export interface BarisAcuan {
  teks_input: string;
  kalori: number;
  protein_g: number;
  karbohidrat_g: number;
  lemak_g: number;
  zat_besi_mg: number;
}

export interface NilaiEstimasi {
  kalori: number;
  protein_g: number;
  karbohidrat_g: number;
  lemak_g: number;
  zat_besi_mg: number;
  tingkat_keyakinan: number;
}

/** Satu baris dataset beserta hasil estimasinya; null bila model gagal ("tanpa estimasi"). */
export interface HasilBaris {
  acuan: BarisAcuan;
  estimasi: NilaiEstimasi | null;
}

export interface MetrikZat {
  /** Baris yang ikut hitungan (estimasi ada dan acuan > 0). */
  n: number;
  /** Baris dengan acuan 0 yang dikecualikan. */
  dikecualikan_acuan_nol: number;
  /** Rata-rata galat relatif (MAPE), pecahan (0.25 = 25%). Null bila n = 0. */
  galat_rata_rata: number | null;
  galat_median: number | null;
  /** Rata-rata galat bertanda: positif berarti model cenderung melebihkan. */
  bias_rata_rata: number | null;
  /** Pecahan baris dengan galat relatif <= 25% dan <= 50%. */
  dalam_25_persen: number | null;
  dalam_50_persen: number | null;
}

export interface SebaranKeyakinan {
  /** < 0,4: model sendiri menandai tidak yakin (docs bagian 9.1). */
  rendah: number;
  /** 0,4 sampai < 0,7. */
  sedang: number;
  /** >= 0,7. */
  tinggi: number;
  rata_rata: number | null;
}

export interface Metrik {
  jumlah_baris: number;
  jumlah_berhasil: number;
  jumlah_tanpa_estimasi: number;
  per_zat: Record<ZatEval, MetrikZat>;
  keyakinan: SebaranKeyakinan;
}

export const BATAS_KEYAKINAN_RENDAH = 0.4;
export const BATAS_KEYAKINAN_TINGGI = 0.7;

/** Galat relatif satu nilai; null bila acuan tidak positif atau nilai bukan angka berhingga. */
export function galatRelatif(estimasi: number, acuan: number): number | null {
  if (!Number.isFinite(estimasi) || !Number.isFinite(acuan) || acuan <= 0) return null;
  return Math.abs(estimasi - acuan) / acuan;
}

/** Galat relatif bertanda ((estimasi - acuan) / acuan); null dengan syarat yang sama. */
export function galatBertanda(estimasi: number, acuan: number): number | null {
  if (!Number.isFinite(estimasi) || !Number.isFinite(acuan) || acuan <= 0) return null;
  return (estimasi - acuan) / acuan;
}

function rata(nilai: number[]): number | null {
  if (nilai.length === 0) return null;
  return nilai.reduce((a, b) => a + b, 0) / nilai.length;
}

function median(nilai: number[]): number | null {
  if (nilai.length === 0) return null;
  const urut = [...nilai].sort((a, b) => a - b);
  const tengah = Math.floor(urut.length / 2);
  return urut.length % 2 === 1 ? urut[tengah]! : (urut[tengah - 1]! + urut[tengah]!) / 2;
}

function metrikZat(hasil: HasilBaris[], zat: ZatEval): MetrikZat {
  const galat: number[] = [];
  const bertanda: number[] = [];
  let dikecualikan = 0;

  for (const h of hasil) {
    if (!h.estimasi) continue;
    const g = galatRelatif(h.estimasi[zat], h.acuan[zat]);
    if (g === null) {
      if (h.acuan[zat] <= 0) dikecualikan++;
      continue;
    }
    galat.push(g);
    bertanda.push(galatBertanda(h.estimasi[zat], h.acuan[zat]) as number);
  }

  const dalam = (batas: number) =>
    galat.length === 0 ? null : galat.filter((g) => g <= batas).length / galat.length;

  return {
    n: galat.length,
    dikecualikan_acuan_nol: dikecualikan,
    galat_rata_rata: rata(galat),
    galat_median: median(galat),
    bias_rata_rata: rata(bertanda),
    dalam_25_persen: dalam(0.25),
    dalam_50_persen: dalam(0.5),
  };
}

export function hitungSebaranKeyakinan(nilai: number[]): SebaranKeyakinan {
  const sebaran: SebaranKeyakinan = { rendah: 0, sedang: 0, tinggi: 0, rata_rata: rata(nilai) };
  for (const k of nilai) {
    if (k < BATAS_KEYAKINAN_RENDAH) sebaran.rendah++;
    else if (k < BATAS_KEYAKINAN_TINGGI) sebaran.sedang++;
    else sebaran.tinggi++;
  }
  return sebaran;
}

export function hitungMetrik(hasil: HasilBaris[]): Metrik {
  const berhasil = hasil.filter((h) => h.estimasi !== null);

  return {
    jumlah_baris: hasil.length,
    jumlah_berhasil: berhasil.length,
    jumlah_tanpa_estimasi: hasil.length - berhasil.length,
    per_zat: Object.fromEntries(ZAT_EVAL.map((z) => [z, metrikZat(hasil, z)])) as Record<ZatEval, MetrikZat>,
    keyakinan: hitungSebaranKeyakinan(berhasil.map((h) => (h.estimasi as NilaiEstimasi).tingkat_keyakinan)),
  };
}

// ---------------------------------------------------------------------------
// CSV acuan
// ---------------------------------------------------------------------------

/** Memecah satu baris CSV sederhana: koma, kutip ganda, "" sebagai kutip di dalam kutip. */
function pecahBaris(baris: string): string[] {
  const kolom: string[] = [];
  let sekarang = "";
  let dalamKutip = false;

  for (let i = 0; i < baris.length; i++) {
    const ch = baris[i]!;
    if (dalamKutip) {
      if (ch === '"' && baris[i + 1] === '"') {
        sekarang += '"';
        i++;
      } else if (ch === '"') {
        dalamKutip = false;
      } else {
        sekarang += ch;
      }
    } else if (ch === '"') {
      dalamKutip = true;
    } else if (ch === ",") {
      kolom.push(sekarang);
      sekarang = "";
    } else {
      sekarang += ch;
    }
  }
  kolom.push(sekarang);
  return kolom.map((k) => k.trim());
}

const KOLOM_WAJIB = ["teks_input", ...ZAT_EVAL] as const;

/**
 * Mem-parsing docs/eval-estimasi.csv. Baris kosong dan baris berawalan `#`
 * diabaikan. Melempar Error (Bahasa Indonesia) bila kolom kurang atau angka tidak valid.
 */
export function parseCsvAcuan(isi: string): BarisAcuan[] {
  const baris = isi
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter((b) => b !== "" && !b.startsWith("#"));

  if (baris.length === 0) throw new Error("CSV acuan kosong.");

  const header = pecahBaris(baris[0]!);
  const indeks = new Map(header.map((h, i) => [h, i]));
  for (const k of KOLOM_WAJIB) {
    if (!indeks.has(k)) throw new Error(`Kolom "${k}" tidak ada di header CSV acuan.`);
  }

  return baris.slice(1).map((b, n) => {
    const kolom = pecahBaris(b);
    const ambil = (k: string) => kolom[indeks.get(k) as number] ?? "";
    const teks = ambil("teks_input");
    if (teks === "") throw new Error(`Baris data ke-${n + 1}: teks_input kosong.`);

    const angka = {} as Record<ZatEval, number>;
    for (const z of ZAT_EVAL) {
      const nilai = Number(ambil(z));
      if (ambil(z) === "" || !Number.isFinite(nilai) || nilai < 0) {
        throw new Error(`Baris data ke-${n + 1} ("${teks}"): kolom ${z} bukan angka tidak negatif.`);
      }
      angka[z] = nilai;
    }
    return { teks_input: teks, ...angka };
  });
}

// ---------------------------------------------------------------------------
// Pemformatan
// ---------------------------------------------------------------------------

function persen(nilai: number | null): string {
  return nilai === null ? "-" : `${(nilai * 100).toFixed(0)}%`;
}

function bertandaPersen(nilai: number | null): string {
  if (nilai === null) return "-";
  const p = (nilai * 100).toFixed(0);
  return nilai > 0 ? `+${p}%` : `${p}%`;
}

/** Ringkasan teks untuk dicetak ke terminal. */
export function formatRingkasan(m: Metrik): string {
  const baris: string[] = [];
  baris.push(`Baris dievaluasi : ${m.jumlah_baris}`);
  baris.push(`Berhasil         : ${m.jumlah_berhasil}`);
  baris.push(`Tanpa estimasi   : ${m.jumlah_tanpa_estimasi}`);
  baris.push("");
  baris.push("Galat relatif per zat gizi (terhadap acuan kasar)");
  baris.push("zat            n   rata-rata  median  bias    <=25%  <=50%  acuan 0");
  for (const z of ZAT_EVAL) {
    const x = m.per_zat[z];
    baris.push(
      [
        z.padEnd(14),
        String(x.n).padStart(3),
        persen(x.galat_rata_rata).padStart(10),
        persen(x.galat_median).padStart(7),
        bertandaPersen(x.bias_rata_rata).padStart(7),
        persen(x.dalam_25_persen).padStart(6),
        persen(x.dalam_50_persen).padStart(6),
        String(x.dikecualikan_acuan_nol).padStart(8),
      ].join(" "),
    );
  }
  baris.push("");
  baris.push("Sebaran tingkat_keyakinan");
  baris.push(`  rendah (<${BATAS_KEYAKINAN_RENDAH})        : ${m.keyakinan.rendah}`);
  baris.push(`  sedang (${BATAS_KEYAKINAN_RENDAH} - <${BATAS_KEYAKINAN_TINGGI}) : ${m.keyakinan.sedang}`);
  baris.push(`  tinggi (>=${BATAS_KEYAKINAN_TINGGI})        : ${m.keyakinan.tinggi}`);
  baris.push(
    `  rata-rata            : ${m.keyakinan.rata_rata === null ? "-" : m.keyakinan.rata_rata.toFixed(2)}`,
  );
  baris.push("");
  baris.push("Catatan: acuan di docs/eval-estimasi.csv adalah perkiraan manual kasar, bukan data lab.");
  baris.push("Laporkan angka ini apa adanya, jangan diklaim sebagai akurasi absolut.");
  return baris.join("\n");
}
