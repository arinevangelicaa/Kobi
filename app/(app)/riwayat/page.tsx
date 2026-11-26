import Link from "next/link";
import SplitBillHistory from "@/components/split-bill/history";
import { auth } from "@/lib/auth";

export const metadata = { title: "Riwayat | Kobi" };

const tabs = [
  { id: "makan", label: "Makan" },
  { id: "analisis", label: "Analisis" },
  { id: "split-bill", label: "Split Bill" },
];

export default async function HistoryPage({ searchParams }: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ tab }, session] = await Promise.all([searchParams, auth()]);
  const current = tabs.find(({ id }) => id === tab) ?? tabs[2];
  return <div className="space-y-4 pt-2">
    <h1 className="text-[28px]/[42px] font-bold text-orange">Riwayat {current.label}</h1>
    <nav aria-label="Jenis riwayat" className="grid grid-cols-3 gap-3">
      {tabs.map(({ id, label }) => <Link
        key={id} href={`/riwayat?tab=${id}`} aria-current={current.id === id ? "page" : undefined}
        className={`grid min-h-10 place-items-center rounded-full px-1 text-center text-sm font-semibold ${current.id === id ? "bg-green text-bone" : "bg-yellow"}`}>
        {label}
      </Link>)}
    </nav>
    {current.id === "split-bill"
      ? <SplitBillHistory userId={session?.user?.id} />
      : <p className="text-sm">Riwayat {current.label.toLowerCase()} belum tersedia.</p>}
  </div>;
}
