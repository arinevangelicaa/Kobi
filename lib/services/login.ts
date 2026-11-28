import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validation/auth";

export interface PenggunaLogin {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Memeriksa kredensial login (email + password). Dipisah dari konfigurasi
 * Auth.js supaya bisa diuji langsung terhadap basis data. Mengembalikan null
 * untuk semua kegagalan (input salah bentuk, email tidak ada, akun tanpa
 * password, password salah) agar pemanggil tidak membedakan penyebabnya.
 */
export async function autentikasiKredensial(kredensial: unknown): Promise<PenggunaLogin | null> {
  const parsed = loginSchema.safeParse(kredensial);
  if (!parsed.success) return null;

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // Akun tanpa password_hash berarti dibuat lewat provider lain
  // (Google, nanti). Jangan bandingkan dengan string kosong.
  if (!user?.password_hash) return null;

  const valid = await verifyPassword(user.password_hash, password);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.nama };
}
