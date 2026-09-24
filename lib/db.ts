import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Next.js dev server melakukan hot reload; tanpa cache global, setiap reload
// membuat PrismaClient baru dan koneksi ke Postgres cepat habis.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL belum diset. Salin .env.example menjadi .env.");
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Dibungkus Proxy supaya PrismaClient baru dibuat saat benar-benar dipakai
// (mis. prisma.user.findUnique(...)), bukan saat modul ini di-import.
// `next build` mengimpor setiap Route Handler untuk mengumpulkan metadata
// halaman tanpa DATABASE_URL tersedia (lihat .github/workflows/main.yml,
// CI sengaja tidak menyentuh basis data) — inisialisasi yang eager membuat
// build gagal walau tidak ada satu pun query yang benar-benar dijalankan.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = client[prop as keyof PrismaClient];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
