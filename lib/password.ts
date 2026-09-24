import { hash, verify } from "@node-rs/argon2";

/**
 * Hashing password sesuai docs/architecture.md bagian 5.5: argon2id.
 *
 * Parameter ditulis eksplisit (bukan mengandalkan default library) supaya
 * hash lama tetap bisa diverifikasi walau default berubah di versi
 * @node-rs/argon2 mendatang. Nilai ini sesuai rekomendasi OWASP untuk argon2id.
 *
 * `algorithm: 2` adalah Algorithm.Argon2id. Ditulis sebagai angka, bukan
 * lewat enum, karena Algorithm adalah const enum dan proyek ini memakai
 * `isolatedModules` (tiap berkas dikompilasi terpisah oleh Next.js/SWC).
 */
const OPTIONS = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}
