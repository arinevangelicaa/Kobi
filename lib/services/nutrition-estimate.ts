/**
 * F2 - Orkestrasi estimasi gizi dari catatan makan teks bebas.
 *
 * Lihat docs/architecture.md bagian 8.2 dan 9.1. Modul ini murni: tidak
 * menyentuh Prisma, hanya memanggil lib/azure/openai.ts dan membentuk hasil
 * siap simpan. Pemanggil (nanti POST /api/meals, issue #9) yang
 * bertanggung jawab menulis ke tabel meal_logs dan nutrition_estimates.
 *
 * BELUM dipasang ke endpoint HTTP mana pun -- menunggu F1 (issue #9)
 * membuat POST /api/meals sebagai tempat memanggilnya. Lihat issue #10.
 */

import { estimasiGiziDariTeks, namaModelVersi, type ItemMakanan } from "@/lib/azure/openai";

export interface EstimasiGiziUntukDb {
  kalori_estimasi: number;
  protein_g: number;
  karbohidrat_g: number;
  lemak_g: number;
  zat_besi_mg: number;
  /** Selalu di-clamp ke rentang 0..1, berapa pun yang dikembalikan model. */
  tingkat_keyakinan: number;
  model_versi: string;
}

export type HasilEstimasiGizi =
  | {
      status: "berhasil";
      estimasi: EstimasiGiziUntukDb;
      /** Dipakai mengisi meal_logs.total_harga bila pengguna tidak menuliskannya manual. */
      estimasi_harga: number;
      /** Rincian item yang dikenali model, untuk ditampilkan sebagai konfirmasi di UI. Tidak disimpan ke DB. */
      items: ItemMakanan[];
    }
  | {
      /**
       * Azure OpenAI belum terprovisioning, gagal dipanggil, atau balasannya
       * tidak valid. Pemanggil tetap menyimpan meal_logs TANPA baris
       * nutrition_estimates, dan menandainya untuk diproses ulang nanti
       * (docs bagian 15) -- bukan mengarang angka.
       */
      status: "tanpa_estimasi";
    };

function clamp01(nilai: number): number {
  if (!Number.isFinite(nilai)) return 0;
  return Math.min(1, Math.max(0, nilai));
}

/**
 * Memperkirakan kandungan gizi dari teks bebas yang diketik pengguna.
 * Tidak pernah throw -- kegagalan apa pun menghasilkan status "tanpa_estimasi".
 */
export async function dapatkanEstimasiGizi(teksInput: string): Promise<HasilEstimasiGizi> {
  const mentah = await estimasiGiziDariTeks(teksInput);

  if (!mentah) {
    return { status: "tanpa_estimasi" };
  }

  return {
    status: "berhasil",
    estimasi: {
      kalori_estimasi: Math.round(mentah.kalori_estimasi),
      protein_g: mentah.protein_g,
      karbohidrat_g: mentah.karbohidrat_g,
      lemak_g: mentah.lemak_g,
      zat_besi_mg: mentah.zat_besi_mg,
      tingkat_keyakinan: clamp01(mentah.tingkat_keyakinan),
      model_versi: namaModelVersi(),
    },
    estimasi_harga: Math.round(mentah.estimasi_harga),
    items: mentah.items,
  };
}
