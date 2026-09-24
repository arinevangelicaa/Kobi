import { handlers } from "@/lib/auth";

// Menangani seluruh sub-rute bawaan Auth.js: /api/auth/session,
// /api/auth/callback/credentials (login), /api/auth/signout, dan seterusnya.
export const { GET, POST } = handlers;
