import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

// Instance NextAuth terpisah dari lib/auth.ts: hanya authConfig (ringan),
// tanpa Credentials provider, Prisma, atau argon2. Lihat lib/auth.config.ts.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Kecualikan aset statis Next.js dan favicon dari pemeriksaan sesi.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
