import { redirect } from "next/navigation";

import ProfilView from "@/components/profile/profil-view";
import { auth } from "@/lib/auth";
import { dapatkanStatistikProfil } from "@/lib/services/profile-stats";

export const metadata = { title: "Profil | Kobi" };

export default async function ProfilPage() {
  const sesi = await auth();
  if (!sesi?.user?.id) redirect("/login?callbackUrl=%2Fprofil");

  const statistik = await dapatkanStatistikProfil(sesi.user.id).catch((error: unknown) => {
    console.error("Gagal mengambil statistik profil", error);
    return null;
  });

  return <ProfilView statistik={statistik} />;
}
