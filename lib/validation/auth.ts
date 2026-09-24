import { z } from "zod";

/** Dipakai POST /api/auth/register. */
export const registerSchema = z.object({
  email: z.email("Email tidak valid").trim().toLowerCase(),
  password: z.string().min(8, "Password minimal 8 karakter"),
  nama: z.string().trim().min(1, "Nama wajib diisi").max(100, "Nama maksimal 100 karakter"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/** Dipakai Credentials provider di lib/auth.ts. */
export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
