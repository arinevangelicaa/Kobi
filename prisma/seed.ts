/**
 * F3 - basis data vendor lokal.
 *
 * Isi berkas ini dengan 15 sampai 20 warung sekitar kampus beserta menu dan
 * perkiraan harganya, hasil pendataan manual tim. Jalankan sekali dengan
 * `npm run db:seed`, bukan pada setiap rilis.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL belum diset.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const jumlah = await prisma.vendor.count();
  console.log(`Vendor terdaftar saat ini: ${jumlah}`);
  console.log("Belum ada data seed. Tambahkan data warung di prisma/seed.ts.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
