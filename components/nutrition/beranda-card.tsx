import type { ReactNode } from "react";

export default function BerandaCard({
  judul,
  hijau = false,
  children,
}: {
  judul: string;
  hijau?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`space-y-2 rounded-2xl border border-green/50 p-3 ${hijau ? "bg-green-light" : "bg-white"}`}>
      <h2 className="font-bold">{judul}</h2>
      {children}
    </section>
  );
}
