import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Next.js dev server melakukan hot reload; tanpa cache global, setiap reload
// membuat PrismaClient baru dan koneksi ke Postgres cepat habis.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Batas koneksi per instance bila DATABASE_POOL_MAX tidak diisi atau tidak valid. */
export const POOL_MAX_DEFAULT = 5;

/**
 * Batas atas DATABASE_POOL_MAX. Nilai lebih besar dipotong, karena PostgreSQL
 * tier kecil hanya mengizinkan puluhan koneksi total dan App Service dapat
 * menjalankan beberapa instance.
 */
export const POOL_MAX_BATAS = 50;

export type KonfigurasiPool = {
  connectionString: string;
  /** Jumlah koneksi maksimum di pool pg untuk instance ini. */
  max: number;
  /** Nilai `sslmode` dari DATABASE_URL (null bila tidak ada atau URL tak terbaca). */
  sslmode: string | null;
  /** Catatan konfigurasi yang patut diketahui operator, bukan kegagalan. */
  peringatan: string[];
};

function bacaSslmode(connectionString: string): string | null {
  try {
    return new URL(connectionString).searchParams.get("sslmode");
  } catch {
    return null;
  }
}

/**
 * Membaca konfigurasi koneksi basis data dari environment. Fungsi murni supaya
 * mudah dites.
 *
 * SSL tidak diatur di sini: driver `pg` membaca `sslmode` langsung dari
 * DATABASE_URL (mis. `?sslmode=require`) dan memverifikasi sertifikat server.
 * Kode ini sengaja tidak pernah menyetel `rejectUnauthorized: false`.
 */
export function bacaKonfigurasiPool(
  env: Record<string, string | undefined>,
): KonfigurasiPool {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL belum diset. Salin .env.example menjadi .env.");
  }

  const peringatan: string[] = [];

  let max = POOL_MAX_DEFAULT;
  const mentah = env.DATABASE_POOL_MAX?.trim();
  if (mentah) {
    const angka = Number(mentah);
    if (Number.isInteger(angka) && angka > POOL_MAX_BATAS) {
      max = POOL_MAX_BATAS;
      peringatan.push(
        `DATABASE_POOL_MAX=${mentah} melebihi batas ${POOL_MAX_BATAS}; dipotong menjadi ${POOL_MAX_BATAS}.`,
      );
    } else if (Number.isInteger(angka) && angka >= 1) {
      max = angka;
    } else {
      peringatan.push(
        `DATABASE_POOL_MAX="${mentah}" tidak valid (harus bilangan bulat >= 1); memakai ${POOL_MAX_DEFAULT}.`,
      );
    }
  }

  const sslmode = bacaSslmode(connectionString);
  if (env.NODE_ENV === "production" && (sslmode === null || sslmode === "disable")) {
    peringatan.push(
      "DATABASE_URL tanpa SSL di produksi; tambahkan ?sslmode=require (docs/architecture.md bagian 5.4).",
    );
  } else if (env.NODE_ENV === "production" && sslmode === "no-verify") {
    // pg memetakan no-verify ke rejectUnauthorized=false: terenkripsi tetapi
    // sertifikat server tidak diperiksa.
    peringatan.push(
      "DATABASE_URL memakai sslmode=no-verify di produksi (sertifikat server tidak diverifikasi); pakai sslmode=require.",
    );
  }

  return { connectionString, max, sslmode, peringatan };
}

function createPrismaClient(): PrismaClient {
  const { connectionString, max, peringatan } = bacaKonfigurasiPool(process.env);
  for (const catatan of peringatan) {
    process.emitWarning(catatan, { code: "KOBI_DB_CONFIG" });
  }

  const adapter = new PrismaPg({ connectionString, max });
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
