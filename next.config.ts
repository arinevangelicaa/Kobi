import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ada package-lock.json lain di direktori induk mesin pengembang; tanpa baris
  // ini Turbopack bisa salah menebak akar proyek.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
