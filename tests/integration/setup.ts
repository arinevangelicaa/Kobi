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

import { pastikanBasisDataUji } from "./pengaman";
import { sesiUji } from "./sesi";

vi.mock("@/lib/auth", () => ({
  auth: async () => (sesiUji.userId ? { user: { id: sesiUji.userId } } : null),
}));

pastikanBasisDataUji(process.env.DATABASE_URL);

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
