import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Tes integrasi butuh Postgres; dijalankan terpisah lewat
    // `npm run test:integration` (vitest.integration.config.ts).
    exclude: [...configDefaults.exclude, "tests/integration/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
