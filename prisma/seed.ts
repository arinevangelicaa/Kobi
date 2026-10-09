/**
 * F3 - Basis data vendor lokal (17 warung sekitar kampus UGM).
 *
 * Data diambil dari hasil survei manual tim di docs/data-warung.md.
 * Skrip ini bersifat idempoten: aman dijalankan berulang kali dengan `npm run db:seed`.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { jamStrKeDate } from "../lib/db-time";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL belum diset. Pastikan .env atau .env.local berisi DATABASE_URL.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

interface MenuSeed {
  nama_menu: string;
  estimasi_harga: number;
  estimasi_kalori: number;
  estimasi_protein_g: number;
}

interface WarungSeed {
  nama_warung: string;
  jenis_vendor: string;
  alamat: string;
  latitude: number;
  longitude: number;
  jam_buka: string; // format "HH:MM"
  jam_tutup: string; // format "HH:MM"
  menus: MenuSeed[];
}

export const DAFTAR_WARUNG_SEED: WarungSeed[] = [
  {
    nama_warung: "Warmindo Pamungkas Pogung",
    jenis_vendor: "warung",
    alamat: "Jl. Pogung Kidul, Pogung Kidul, Sinduadi, Kec. Mlati, Kabupaten Sleman, DIY 55284",
    latitude: -7.763461,
    longitude: 110.373656,
    jam_buka: "00:00",
    jam_tutup: "23:59",
    menus: [
      { nama_menu: "Orak arik telor", estimasi_harga: 8000, estimasi_kalori: 280, estimasi_protein_g: 12 },
      { nama_menu: "Nasi goreng", estimasi_harga: 10000, estimasi_kalori: 450, estimasi_protein_g: 9 },
      { nama_menu: "Susu", estimasi_harga: 3000, estimasi_kalori: 120, estimasi_protein_g: 6 },
    ],
  },
  {
    nama_warung: "Ayam Goreng Ninit Pogung Kidul",
    jenis_vendor: "warung",
    alamat: "Jl. Pogung Kidul No.4, Pogung Kidul, Sinduadi, Kec. Mlati, Kabupaten Sleman, DIY 55284",
    latitude: -7.763242,
    longitude: 110.373413,
    jam_buka: "09:00",
    jam_tutup: "16:55",
    menus: [
      { nama_menu: "Nasi ayam goreng tahu", estimasi_harga: 18000, estimasi_kalori: 550, estimasi_protein_g: 26 },
      { nama_menu: "Nasi lele goreng", estimasi_harga: 16000, estimasi_kalori: 480, estimasi_protein_g: 22 },
      { nama_menu: "Es jeruk", estimasi_harga: 5000, estimasi_kalori: 90, estimasi_protein_g: 0.5 },
    ],
  },
  {
    nama_warung: "Rumah Makan Mas Kobis",
    jenis_vendor: "warung",
    alamat: "Jl. Selokan Mataram, Pogung Kidul, Sinduadi, Kec. Mlati, Kabupaten Sleman, DIY 55284",
    latitude: -7.763823,
    longitude: 110.374304,
    jam_buka: "10:30",
    jam_tutup: "21:00",
    menus: [
      { nama_menu: "Pak Tila (nasi, ati ampela, tempe, kobis/terong, es teh)", estimasi_harga: 21000, estimasi_kalori: 520, estimasi_protein_g: 24 },
      { nama_menu: "Pak Yam (nasi, ayam, telur, kobis/terong, es teh)", estimasi_harga: 23000, estimasi_kalori: 620, estimasi_protein_g: 30 },
      { nama_menu: "Milo", estimasi_harga: 5000, estimasi_kalori: 130, estimasi_protein_g: 3 },
    ],
  },
  {
    nama_warung: "Mie Ayam Palembang Afui",
    jenis_vendor: "warung",
    alamat: "Gg. Kinanti No.4-5, RW.12, Kocoran, Caturtunggal, Depok, Sleman, DIY 55281",
    latitude: -7.763684,
    longitude: 110.377918,
    jam_buka: "09:00",
    jam_tutup: "19:00",
    menus: [
      { nama_menu: "Mie ayam biasa", estimasi_harga: 11000, estimasi_kalori: 420, estimasi_protein_g: 16 },
      { nama_menu: "Kwetiaw pangsit", estimasi_harga: 15000, estimasi_kalori: 450, estimasi_protein_g: 15 },
      { nama_menu: "Air es", estimasi_harga: 1500, estimasi_kalori: 0, estimasi_protein_g: 0 },
    ],
  },
  {
    nama_warung: "Ayam Geprek & Susu (Preksu) Colombo",
    jenis_vendor: "warung",
    alamat: "Jl. Karangmalang, Samirono, Caturtunggal, Kec. Depok, Kabupaten Sleman, DIY 55281",
    latitude: -7.777245,
    longitude: 110.38474,
    jam_buka: "09:00",
    jam_tutup: "21:00",
    menus: [
      { nama_menu: "Paket Geprek (Paha bawah) Kremes + Nasi", estimasi_harga: 16000, estimasi_kalori: 580, estimasi_protein_g: 25 },
      { nama_menu: "Paket Geprek (Sayap) Mozarella + Nasi", estimasi_harga: 18000, estimasi_kalori: 610, estimasi_protein_g: 27 },
      { nama_menu: "Susu murni", estimasi_harga: 10000, estimasi_kalori: 130, estimasi_protein_g: 7 },
    ],
  },
  {
    nama_warung: "SGPC Bu Wiryo 1959",
    jenis_vendor: "warung",
    alamat: "Jl. Agro No.10, Kocoran, Caturtunggal, Kec. Depok, Kabupaten Sleman, DIY 55281",
    latitude: -7.765994,
    longitude: 110.385001,
    jam_buka: "06:30",
    jam_tutup: "20:00",
    menus: [
      { nama_menu: "Nasi pecel", estimasi_harga: 20000, estimasi_kalori: 380, estimasi_protein_g: 10 },
      { nama_menu: "Mendoan", estimasi_harga: 3000, estimasi_kalori: 180, estimasi_protein_g: 7 },
      { nama_menu: "Teh tawar", estimasi_harga: 2000, estimasi_kalori: 0, estimasi_protein_g: 0 },
    ],
  },
  {
    nama_warung: "Ayam Geprek Bu Rum 1",
    jenis_vendor: "warung",
    alamat: "Jl. Wulung Lor, Papringan, Caturtunggal, Kec. Depok, Kabupaten Sleman, DIY 55281",
    latitude: -7.775623,
    longitude: 110.395406,
    jam_buka: "08:00",
    jam_tutup: "20:00",
    menus: [
      { nama_menu: "Nag Ori", estimasi_harga: 13000, estimasi_kalori: 540, estimasi_protein_g: 24 },
      { nama_menu: "Nag Sambalado", estimasi_harga: 15000, estimasi_kalori: 550, estimasi_protein_g: 24 },
      { nama_menu: "Nutrisari", estimasi_harga: 3000, estimasi_kalori: 80, estimasi_protein_g: 0 },
    ],
  },
  {
    nama_warung: "Olive Fried Chicken - Karang Wuni",
    jenis_vendor: "warung",
    alamat: "Depok, Gg. Wuni No.KM.5,2, Karang Wuni, Caturtunggal, Sleman, DIY 55281",
    latitude: -7.760416,
    longitude: 110.382025,
    jam_buka: "09:00",
    jam_tutup: "21:00",
    menus: [
      { nama_menu: "Paket Teh (Dada)", estimasi_harga: 15000, estimasi_kalori: 560, estimasi_protein_g: 30 },
      { nama_menu: "Paket Teh (Paha atas)", estimasi_harga: 15000, estimasi_kalori: 580, estimasi_protein_g: 27 },
      { nama_menu: "Soft drink", estimasi_harga: 4000, estimasi_kalori: 140, estimasi_protein_g: 0 },
    ],
  },
  {
    nama_warung: "M Mie Resto Jakal",
    jenis_vendor: "warung",
    alamat: "KM 5, Jl. Kaliurang Gg. Tejomoyo No.4, Kocoran, Baru, Kec. Depok, Kabupaten Sleman, DIY 55281",
    latitude: -7.760557,
    longitude: 110.380169,
    jam_buka: "09:00",
    jam_tutup: "16:30",
    menus: [
      { nama_menu: "Yammie Gurih", estimasi_harga: 12000, estimasi_kalori: 390, estimasi_protein_g: 14 },
      { nama_menu: "Nasi Sop Bakso", estimasi_harga: 12000, estimasi_kalori: 410, estimasi_protein_g: 18 },
      { nama_menu: "Lemon tea", estimasi_harga: 5000, estimasi_kalori: 90, estimasi_protein_g: 0 },
    ],
  },
  {
    nama_warung: "Huma Rasa",
    jenis_vendor: "warung",
    alamat: "Gg. Siti Sonya, Pogung Kidul, Sinduadi, Kec. Mlati, Kabupaten Sleman, DIY 55281",
    latitude: -7.762329,
    longitude: 110.379021,
    jam_buka: "10:00",
    jam_tutup: "21:00",
    menus: [
      { nama_menu: "Nasi daun jeruk + Ayam bawang putih", estimasi_harga: 18000, estimasi_kalori: 560, estimasi_protein_g: 28 },
      { nama_menu: "Nasi ayam rica bumbu kalimantan", estimasi_harga: 18000, estimasi_kalori: 570, estimasi_protein_g: 27 },
      { nama_menu: "Air es", estimasi_harga: 1000, estimasi_kalori: 0, estimasi_protein_g: 0 },
    ],
  },
  {
    nama_warung: "Warung Jepun",
    jenis_vendor: "warung",
    alamat: "Gg. Siti Sonya 63, Jl. Kaliurang KM 5, Pogung Kidul, Sinduadi, Kec. Mlati, Kabupaten Sleman, DIY 55281",
    latitude: -7.76203,
    longitude: 110.37853,
    jam_buka: "08:00",
    jam_tutup: "21:00",
    menus: [
      { nama_menu: "Paket ayam bakar", estimasi_harga: 22500, estimasi_kalori: 550, estimasi_protein_g: 28 },
      { nama_menu: "Paket telur goreng", estimasi_harga: 14000, estimasi_kalori: 420, estimasi_protein_g: 14 },
      { nama_menu: "Ovaltine", estimasi_harga: 4000, estimasi_kalori: 120, estimasi_protein_g: 2 },
    ],
  },
  {
    nama_warung: "Rumah Makan Padang Sabana Murah 3 UGM",
    jenis_vendor: "warung",
    alamat: "Gg. Swakarya, Kocoran, Caturtunggal, Kec. Depok, Kabupaten Sleman, DIY 55281",
    latitude: -7.764845,
    longitude: 110.381738,
    jam_buka: "07:00",
    jam_tutup: "22:00",
    menus: [
      { nama_menu: "Nasi, sayur, ayam goreng crispy", estimasi_harga: 13000, estimasi_kalori: 580, estimasi_protein_g: 26 },
      { nama_menu: "Nasi, sayur, ayam rendang", estimasi_harga: 13000, estimasi_kalori: 600, estimasi_protein_g: 28 },
      { nama_menu: "Sup buah", estimasi_harga: 8000, estimasi_kalori: 210, estimasi_protein_g: 2 },
    ],
  },
  {
    nama_warung: "Sambel Cowek Karanggayamm",
    jenis_vendor: "warung",
    alamat: "Jl. Sendok No.119c, Manggung, Caturtunggal, Kec. Depok, Kabupaten Sleman, DIY 55281",
    latitude: -7.762821,
    longitude: 110.388007,
    jam_buka: "09:00",
    jam_tutup: "23:00",
    menus: [
      { nama_menu: "Paket plus fillet ikan + es teh", estimasi_harga: 15000, estimasi_kalori: 490, estimasi_protein_g: 22 },
      { nama_menu: "Paket cumi tepung + es teh", estimasi_harga: 16000, estimasi_kalori: 520, estimasi_protein_g: 20 },
      { nama_menu: "Jus melon", estimasi_harga: 6000, estimasi_kalori: 110, estimasi_protein_g: 1 },
    ],
  },
  {
    nama_warung: "Warmindo Corner",
    jenis_vendor: "warung",
    alamat: "Klebengan Ruko, Jl. Jeruk CT VIII No.Blok F1, Kocoran, Caturtunggal, Kec. Depok, Kabupaten Sleman, DIY 55281",
    latitude: -7.765897,
    longitude: 110.384362,
    jam_buka: "07:00",
    jam_tutup: "23:59",
    menus: [
      { nama_menu: "Magelangan biasa", estimasi_harga: 13000, estimasi_kalori: 540, estimasi_protein_g: 13 },
      { nama_menu: "Nasi goreng udang", estimasi_harga: 16000, estimasi_kalori: 510, estimasi_protein_g: 18 },
      { nama_menu: "Energen", estimasi_harga: 4000, estimasi_kalori: 130, estimasi_protein_g: 3 },
    ],
  },
  {
    nama_warung: "SBC Spesial Cah Kangkung",
    jenis_vendor: "warung",
    alamat: "Jl. Pandega Marta, Jl. Pogung Kidul No.102A, Pogung Kidul, Sinduadi, Kec. Mlati, Kabupaten Sleman, DIY 55281",
    latitude: -7.756412,
    longitude: 110.372881,
    jam_buka: "08:00",
    jam_tutup: "22:00",
    menus: [
      { nama_menu: "Paket sehat telur dadar", estimasi_harga: 13000, estimasi_kalori: 430, estimasi_protein_g: 14 },
      { nama_menu: "Paket sehat crispy jamur", estimasi_harga: 15500, estimasi_kalori: 380, estimasi_protein_g: 8 },
      { nama_menu: "Jus mangga", estimasi_harga: 12000, estimasi_kalori: 140, estimasi_protein_g: 1 },
    ],
  },
  {
    nama_warung: "Waroeng Toetoeng",
    jenis_vendor: "warung",
    alamat: "Jl. Pogung Baru No.E30A, Pogung Kidul, Sinduadi, Kec. Mlati, Kabupaten Sleman, DIY 55281",
    latitude: -7.759024,
    longitude: 110.376492,
    jam_buka: "06:30",
    jam_tutup: "19:00",
    menus: [
      { nama_menu: "Nasi ayam teriyaki", estimasi_harga: 14000, estimasi_kalori: 530, estimasi_protein_g: 25 },
      { nama_menu: "Nasi gurame asam manis", estimasi_harga: 19000, estimasi_kalori: 520, estimasi_protein_g: 24 },
      { nama_menu: "Es Dancow", estimasi_harga: 8000, estimasi_kalori: 140, estimasi_protein_g: 5 },
    ],
  },
  {
    nama_warung: "Mie Ayam Bakso Pak Sulis",
    jenis_vendor: "warung",
    alamat: "Jl. Pandega Marta, Pogung Kidul, Sinduadi, Kec. Mlati, Kabupaten Sleman, DIY 55281",
    latitude: -7.756539,
    longitude: 110.372124,
    jam_buka: "11:00",
    jam_tutup: "20:00",
    menus: [
      { nama_menu: "Bakso", estimasi_harga: 12000, estimasi_kalori: 350, estimasi_protein_g: 18 },
      { nama_menu: "Bakso pangsit", estimasi_harga: 15000, estimasi_kalori: 420, estimasi_protein_g: 19 },
      { nama_menu: "Es dawet", estimasi_harga: 5000, estimasi_kalori: 180, estimasi_protein_g: 2 },
    ],
  },
];

async function main() {
  console.log(`Memulai seeding ${DAFTAR_WARUNG_SEED.length} warung dan menu...`);

  let totalVendorBaru = 0;
  let totalMenuBaru = 0;

  for (const dataWarung of DAFTAR_WARUNG_SEED) {
    const jamBukaDate = jamStrKeDate(dataWarung.jam_buka);
    const jamTutupDate = jamStrKeDate(dataWarung.jam_tutup);

    // Cari apakah vendor sudah pernah di-seed sebelumnya berdasarkan nama_warung
    let vendor = await prisma.vendor.findFirst({
      where: { nama_warung: dataWarung.nama_warung },
    });

    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: {
          nama_warung: dataWarung.nama_warung,
          jenis_vendor: dataWarung.jenis_vendor,
          alamat: dataWarung.alamat,
          latitude: dataWarung.latitude,
          longitude: dataWarung.longitude,
          jam_buka: jamBukaDate,
          jam_tutup: jamTutupDate,
          diverifikasi_pada: new Date(),
        },
      });
      totalVendorBaru++;
    } else {
      // Perbarui metadata jika ada revisi
      await prisma.vendor.update({
        where: { id: vendor.id },
        data: {
          jenis_vendor: dataWarung.jenis_vendor,
          alamat: dataWarung.alamat,
          latitude: dataWarung.latitude,
          longitude: dataWarung.longitude,
          jam_buka: jamBukaDate,
          jam_tutup: jamTutupDate,
        },
      });
    }

    // Seeding menu items untuk vendor ini
    for (const menuData of dataWarung.menus) {
      const existingMenu = await prisma.menuItem.findFirst({
        where: {
          vendor_id: vendor.id,
          nama_menu: menuData.nama_menu,
        },
      });

      if (!existingMenu) {
        await prisma.menuItem.create({
          data: {
            vendor_id: vendor.id,
            nama_menu: menuData.nama_menu,
            estimasi_harga: menuData.estimasi_harga,
            estimasi_kalori: menuData.estimasi_kalori,
            estimasi_protein_g: menuData.estimasi_protein_g,
            tersedia: true,
          },
        });
        totalMenuBaru++;
      } else {
        // Perbarui estimasi harga/gizi jika ada perubahan
        await prisma.menuItem.update({
          where: { id: existingMenu.id },
          data: {
            estimasi_harga: menuData.estimasi_harga,
            estimasi_kalori: menuData.estimasi_kalori,
            estimasi_protein_g: menuData.estimasi_protein_g,
            tersedia: true,
          },
        });
      }
    }
  }

  const jumlahVendor = await prisma.vendor.count();
  const jumlahMenu = await prisma.menuItem.count();

  console.log(`Seeding selesai!`);
  console.log(`- Vendor baru ditambahkan: ${totalVendorBaru}`);
  console.log(`- Menu baru ditambahkan: ${totalMenuBaru}`);
  console.log(`- Total vendor di database: ${jumlahVendor}`);
  console.log(`- Total menu di database: ${jumlahMenu}`);
}

main()
  .catch((error) => {
    console.error("Gagal melakukan seed basis data:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
