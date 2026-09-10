import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 memindahkan connection URL dari schema.prisma ke berkas ini.
// Runtime aplikasi memakai adapter di lib/db.ts; berkas ini hanya untuk CLI
// (migrate, studio, seed).
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
