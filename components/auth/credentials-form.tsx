"use client";

import { useActionState, type ReactNode } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import Button from "@/components/ui/button";

export default function CredentialsForm({
  mode,
  children,
}: {
  mode: "login" | "signup";
  children: ReactNode;
}) {
  const daftar = mode === "signup";
  const router = useRouter();
  const [pesan, submit, pending] = useActionState(
    async (_: string | null, data: FormData) => {
      const email = String(data.get("email") ?? "");
      const password = String(data.get("password") ?? "");

      try {
        if (daftar) {
          const hasil = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, nama: data.get("nama") }),
          });

          if (!hasil.ok) {
            const isi = await hasil.json().catch(() => null);
            return isi?.error?.message ?? "Pendaftaran gagal. Coba lagi.";
          }

          router.replace("/login");
          return null;
        }

        const hasil = await signIn("credentials", { email, password, redirect: false });
        if (hasil?.error === "CredentialsSignin") return "Email atau password salah.";
        if (!hasil?.ok || hasil.error) return "Login gagal. Coba lagi.";

        router.replace("/beranda");
        return null;
      } catch {
        return "Layanan autentikasi tidak bisa dihubungi. Coba lagi.";
      }
    },
    null,
  );

  return (
    <form action={submit} className="space-y-3">
      {children}
      {pesan && <p role="alert" className="text-sm font-medium">{pesan}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Memproses…" : daftar ? "Sign Up" : "Login"}
      </Button>
    </form>
  );
}
