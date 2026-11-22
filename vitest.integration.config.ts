import path from "node:path";
import { defineConfig } from "vitest/config";

// Tes integrasi: Route Handler dipanggil langsung terhadap Postgres SUNGGUHAN
// (docs/architecture.md bagian 16). Dipisah dari vitest.config.ts supaya
// `npm test` tetap hanya tes unit dan tidak butuh basis data.
//
// DATABASE_URL harus menunjuk ke basis data uji (lihat tests/integration/setup.ts
// yang menolak basis data selain itu). Jalankan lewat scripts/test-integration.sh
// (menyalakan Postgres di Docker) atau, di CI, lewat service container.

// Zona waktu proses sengaja BUKAN UTC (runner CI/Azure) dan BUKAN WIB (mesin
// pengembang), supaya kode yang diam-diam bergantung pada TZ proses ketahuan di
// kedua lingkungan. Bisa ditimpa: INTEGRATION_TZ=UTC npm run test:integration.
// Worker mewarisi env proses induk, jadi cukup disetel di sini.
process.env.TZ = process.env.INTEGRATION_TZ ?? "America/Los_Angeles";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    // Semua berkas berbagi satu basis data dan saling membersihkan tabel,
    // jadi berkas dijalankan berurutan, bukan paralel.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
