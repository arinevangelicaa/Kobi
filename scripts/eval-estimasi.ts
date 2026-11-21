/**
 * Evaluasi estimasi gizi Azure OpenAI terhadap acuan manual (issue #58).
 *
 * Jalankan:  npm run eval:estimasi
 *
 * Memanggil Azure OpenAI sungguhan (berbayar, memakai kuota), jadi TIDAK
 * dijalankan di CI. Butuh AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, dan
 * AZURE_OPENAI_DEPLOYMENT di env atau .env. Bila belum lengkap, skrip keluar
 * dengan pesan jelas tanpa memanggil apa pun.
 *
 * Perhitungan metrik ada di scripts/eval-metrics.ts (murni dan diuji unit).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";

import { dapatkanEstimasiGizi } from "../lib/services/nutrition-estimate";
import { formatRingkasan, hitungMetrik, parseCsvAcuan, type HasilBaris } from "./eval-metrics";

const ENV_WAJIB = ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT"] as const;
const JEDA_ANTAR_PANGGILAN_MS = 300;
const BERKAS_CSV = path.resolve(__dirname, "../docs/eval-estimasi.csv");

function tidur(ms: number): Promise<void> {
  return new Promise((selesai) => setTimeout(selesai, ms));
}

async function utama(): Promise<number> {
  const kurang = ENV_WAJIB.filter((k) => !process.env[k]);
  if (kurang.length > 0) {
    console.error(
      `Evaluasi dibatalkan: env Azure OpenAI belum lengkap (${kurang.join(", ")} belum diset).\n` +
        "Isi nilainya di .env (lihat .env.example) setelah resource Azure OpenAI tersedia (issue #33), lalu jalankan ulang.",
    );
    return 1;
  }

  const acuan = parseCsvAcuan(readFileSync(BERKAS_CSV, "utf8"));
  console.log(`Mengevaluasi ${acuan.length} makanan dari docs/eval-estimasi.csv ...\n`);

  const hasil: HasilBaris[] = [];
  for (const [i, baris] of acuan.entries()) {
    const e = await dapatkanEstimasiGizi(baris.teks_input);
    hasil.push({
      acuan: baris,
      estimasi:
        e.status === "berhasil"
          ? {
              kalori: e.estimasi.kalori_estimasi,
              protein_g: e.estimasi.protein_g,
              karbohidrat_g: e.estimasi.karbohidrat_g,
              lemak_g: e.estimasi.lemak_g,
              zat_besi_mg: e.estimasi.zat_besi_mg,
              tingkat_keyakinan: e.estimasi.tingkat_keyakinan,
            }
          : null,
    });

    const ringkas = e.status === "berhasil" ? `${e.estimasi.kalori_estimasi} kkal (keyakinan ${e.estimasi.tingkat_keyakinan.toFixed(2)})` : "TANPA ESTIMASI";
    console.log(`${String(i + 1).padStart(2)}. ${baris.teks_input}: acuan ${baris.kalori} kkal, model ${ringkas}`);
    await tidur(JEDA_ANTAR_PANGGILAN_MS);
  }

  console.log(`\n${formatRingkasan(hitungMetrik(hasil))}`);

  // Kunci salah, 403, atau jaringan putus membuat semua baris "TANPA ESTIMASI".
  // Jangan keluar 0 seolah evaluasi lulus padahal tidak ada hasil sama sekali.
  if (hasil.every((h) => h.estimasi === null)) {
    console.error("\nEvaluasi gagal: tidak ada satu pun estimasi berhasil. Cek kunci, endpoint, dan deployment Azure OpenAI.");
    return 1;
  }
  return 0;
}

utama().then(
  (kode) => process.exit(kode),
  (galat) => {
    console.error("Evaluasi gagal:", galat instanceof Error ? galat.message : galat);
    process.exit(1);
  },
);
