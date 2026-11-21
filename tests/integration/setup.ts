/**
 * Setup bersama tes integrasi (dijalankan sebelum tiap berkas tes).
 *
 * 1. Pengaman: menolak berjalan bila DATABASE_URL bukan basis data uji lokal,
 *    karena tes membersihkan tabel (TRUNCATE) dan tidak boleh sampai menyentuh
 *    basis data pengembang atau Azure.
 * 2. Memastikan tidak ada panggilan Azure sungguhan: Azure Maps dinonaktifkan
 *    (rekomendasi jatuh ke Haversine) dan Azure OpenAI diberi kredensial palsu
 *    yang hanya cocok dengan `fetch` tiruan (lihat helpers.ts).
 * 3. Memotong `@/lib/auth` supaya `auth()` mengembalikan pengguna uji.
 */

import { beforeEach, vi } from "vitest";

import { sesiUji } from "./sesi";

vi.mock("@/lib/auth", () => ({
  auth: async () => (sesiUji.userId ? { user: { id: sesiUji.userId } } : null),
}));

const HOST_LOKAL = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function pastikanBasisDataUji() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL belum diset. Jalankan lewat scripts/test-integration.sh (Docker) " +
        "atau set DATABASE_URL ke basis data uji lokal, mis. " +
        "postgresql://kobi:kobi_test@127.0.0.1:54329/kobi_test.",
    );
  }

  let alamat: URL;
  try {
    alamat = new URL(url);
  } catch {
    throw new Error("DATABASE_URL tidak dapat dibaca sebagai URL.");
  }

  const namaDb = decodeURIComponent(alamat.pathname.replace(/^\//, ""));
  if (!HOST_LOKAL.has(alamat.hostname) || !/test/i.test(namaDb)) {
    throw new Error(
      `Tes integrasi menolak DATABASE_URL ini (host "${alamat.hostname}", basis data "${namaDb}"): ` +
        "hanya host lokal dengan nama basis data yang memuat 'test' yang diizinkan, " +
        "karena tes mengosongkan tabel.",
    );
  }
}

pastikanBasisDataUji();

// Tidak ada kunci Azure Maps: hitungJarakWaktuBanyakTujuan mengembalikan Map
// kosong sehingga rekomendasi memakai Haversine (`sumber_jarak: "estimasi"`).
delete process.env.AZURE_MAPS_KEY;

// Kredensial palsu. `fetch` global selalu diganti tiruan di tes yang memanggil
// estimasi; titik akhir `.invalid` tidak pernah bisa di-resolve sungguhan.
process.env.AZURE_OPENAI_ENDPOINT = "https://azure-tiruan.invalid";
process.env.AZURE_OPENAI_API_KEY = "kunci-uji";
process.env.AZURE_OPENAI_DEPLOYMENT = "deployment-uji";

beforeEach(() => {
  // Pesan warn/log dari logger aplikasi hanya bising di keluaran tes. console.error
  // sengaja dibiarkan: itu tanda galat tak terduga yang perlu terlihat.
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
