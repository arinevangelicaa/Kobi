import type { DefaultSession } from "next-auth";

// session.user.id tidak ada di tipe bawaan Auth.js. Ditambahkan di sini
// supaya lib/auth.ts dan kode yang membaca sesi (mis. Route Handler) type-safe.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
