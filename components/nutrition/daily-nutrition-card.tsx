import Link from "next/link";

import BerandaCard from "@/components/nutrition/beranda-card";
import type { GiziHarian } from "@/lib/services/daily-nutrition";
import { kalimatKesenjangan, kesenjanganTeratas } from "@/lib/services/nutrition-gap";

const formatAngka = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const nutrisi = [
  { zat: "karbohidrat_g", label: "Karbo", satuan: "g" },
  { zat: "protein_g", label: "Protein", satuan: "g" },
  { zat: "lemak_g", label: "Lemak", satuan: "g" },
  { zat: "zat_besi_mg", label: "Zat besi", satuan: "mg" },
] as const;

export default function DailyNutritionCard({ gizi }: { gizi: GiziHarian }) {
  const { target, asupan, jumlah_catatan, jumlah_tanpa_estimasi, jumlah_keyakinan_rendah } = gizi;
  const adaEstimasi = jumlah_catatan > jumlah_tanpa_estimasi;
  const prioritas = target && adaEstimasi ? kesenjanganTeratas(target, asupan) : [];

  return (
    <>
      <BerandaCard judul="Nutrisi harian">
        <dl className="grid grid-cols-4 gap-2">
          {nutrisi.map(({ zat, label, satuan }) => (
            <div key={zat} className="rounded-xl bg-green-light px-1 py-1 text-center text-xxs font-semibold">
              <dt>{label}</dt>
              <dd>{adaEstimasi ? formatAngka.format(asupan[zat]) : "—"} / {target ? formatAngka.format(target[zat]) : "—"} {satuan}</dd>
            </div>
          ))}
        </dl>
        {(target || adaEstimasi) && (
          <details>
            <summary className="cursor-pointer text-xs font-semibold">Detail kalori</summary>
            <p className="mt-2 text-xs">
              Asupan: {adaEstimasi ? `${formatAngka.format(asupan.kalori)} kkal` : "belum tersedia"}
              {target && ` · Target: ${formatAngka.format(target.kalori)} kkal`}
            </p>
          </details>
        )}
      </BerandaCard>

      <section
        aria-labelledby="judul-kesenjangan"
        className="space-y-2 rounded-2xl border border-green/50 bg-green-light p-3"
      >
        <h2 id="judul-kesenjangan" className="font-bold">Kesenjangan gizi hari ini</h2>
        {!target && (
          <p className="text-sm">
            Target gizi belum tersedia.{" "}
            <Link href="/profil" className="font-semibold underline underline-offset-2">
              Lengkapi profil
            </Link>{" "}
            untuk mendapatkan target harian.
          </p>
        )}
        {jumlah_catatan === 0 && (
          <p className="text-sm">
            Belum ada catatan makan hari ini.{" "}
            <Link href="/catat" className="font-semibold underline underline-offset-2">
              Catat makanan
            </Link>
          </p>
        )}
        {target && adaEstimasi && (
          prioritas.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm marker:text-orange">
              {prioritas.map((gap) => <li key={gap.zat}>{kalimatKesenjangan(gap)}</li>)}
            </ul>
          ) : (
            <p className="text-sm">Target zat gizi hari ini sudah tercukupi berdasarkan estimasi.</p>
          )
        )}
        {jumlah_keyakinan_rendah > 0 && (
          <p className="rounded-lg bg-cream px-3 py-2 text-xs">
            {jumlah_keyakinan_rendah} catatan memiliki estimasi dengan keyakinan rendah dan tetap dihitung dalam asupan.
          </p>
        )}
        {jumlah_tanpa_estimasi > 0 && (
          <p className="rounded-lg bg-cream px-3 py-2 text-xs">
            {jumlah_tanpa_estimasi} catatan belum punya estimasi sehingga belum ikut dihitung.
          </p>
        )}
      </section>

    </>
  );
}
