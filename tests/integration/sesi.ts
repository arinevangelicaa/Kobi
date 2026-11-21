/** Sesi pengguna uji yang dibaca oleh tiruan `auth()` di setup.ts. */
export const sesiUji: { userId: string | null } = { userId: null };

/** Menjadikan `userId` sebagai pengguna yang login (null = tanpa sesi). */
export function masukSebagai(userId: string | null) {
  sesiUji.userId = userId;
}
