import { redirect } from "next/navigation";

import BerandaView from "@/components/nutrition/beranda-view";
import { auth } from "@/lib/auth";
import { dapatkanBeranda } from "@/lib/services/beranda";

export const metadata = { title: "Beranda | Kobi" };

export default async function BerandaPage() {
  const sesi = await auth();
  if (!sesi?.user?.id) redirect("/login?callbackUrl=%2Fberanda");

  const data = await dapatkanBeranda(sesi.user.id);
  const nama = sesi.user.name?.trim().split(/\s+/)[0];

  return <BerandaView data={data} nama={nama} />;
}
