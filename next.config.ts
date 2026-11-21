import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keluaran mandiri (.next/standalone/server.js) untuk App Service: hanya
  // memuat dependensi yang dipakai, jadi artefak deploy jauh lebih kecil.
  output: "standalone",
  // Ada package-lock.json lain di direktori induk mesin pengembang; tanpa baris
  // ini Turbopack bisa salah menebak akar proyek.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
