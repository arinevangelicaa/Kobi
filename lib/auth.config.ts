import type { NextAuthConfig } from "next-auth";

/**
 * Konfigurasi ringan tanpa Prisma atau argon2, dipakai middleware.ts.
 *
 * lib/auth.ts memperluas berkas ini dengan Credentials provider untuk Route
 * Handler. Pemisahan ini supaya middleware (jalan di setiap permintaan) tidak
 * ikut memuat Prisma Client dan binding native argon2.
 */
export const authConfig = {
  // Auth.js hanya mempercayai host secara otomatis di Vercel. Kobi di-hosting
  // di Azure App Service (docs/architecture.md bagian 14), jadi host harus
  // dipercaya eksplisit di sini, bukan lewat AUTH_TRUST_HOST env var yang
  // gampang lupa di-set saat provisioning.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const sudahLogin = !!auth?.user;
      const rutePublik =
        nextUrl.pathname === "/" ||
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/register") ||
        nextUrl.pathname.startsWith("/api/auth") ||
        nextUrl.pathname === "/api/health";

      if (rutePublik) return true;
      return sudahLogin;
    },
  },
  providers: [], // diisi di lib/auth.ts
} satisfies NextAuthConfig;
