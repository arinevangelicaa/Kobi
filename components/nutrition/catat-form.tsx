"use client";

import { useRef, useState, type FormEvent } from "react";

import Button from "@/components/ui/button";
import CatatPhotoPicker from "@/components/nutrition/catat-photo-picker";
import { simpanCatatanMakan, ulangiEstimasiMakan } from "@/lib/meal-client";
import { BATAS_TEKS_INPUT, mealCreateSchema } from "@/lib/validation/meal";

const formatGizi = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const nutrisi = [
  { key: "kalori_estimasi", label: "Kalori", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "karbohidrat_g", label: "Karbohidrat", unit: "g" },
  { key: "lemak_g", label: "Lemak", unit: "g" },
] as const;

export default function CatatForm() {
  const [teks, setTeks] = useState("");
  const [hasil, setHasil] = useState<Awaited<ReturnType<typeof simpanCatatanMakan>> | null>(null);
  const [galat, setGalat] = useState("");
  const [proses, setProses] = useState<"simpan" | "ulangi" | null>(null);
  const sedangProses = useRef(false);
  const meal = hasil?.meal;
  const estimasi = meal?.estimasi;
  const sudahDicatat = meal?.teks_input === teks.trim();

  async function analisis(jenis: "simpan" | "ulangi", request: () => ReturnType<typeof simpanCatatanMakan>) {
    if (sedangProses.current) return;
    sedangProses.current = true;
    setProses(jenis);
    setGalat("");
    try {
      setHasil(await request());
    } catch (error) {
      setGalat(error instanceof Error ? error.message : "Catatan tidak dapat diproses.");
    } finally {
      sedangProses.current = false;
      setProses(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sedangProses.current) return;
    if (sudahDicatat) {
      setTeks("");
      setHasil(null);
      setGalat("");
      return;
    }

    const parsed = mealCreateSchema.safeParse({ teks_input: teks });
    if (!parsed.success) {
      setGalat(parsed.error.issues[0].message);
      return;
    }
    void analisis("simpan", () => simpanCatatanMakan(parsed.data.teks_input));
  }

  return (
    <div className="space-y-4">
      <form method="post" onSubmit={submit} className="grid gap-3.5 rounded-3xl bg-white p-4 ring-1 ring-green/10 ring-inset">
        <div className="grid gap-2">
          <label htmlFor="deskripsi-makanan" className="text-sm leading-5">Apa yang kamu makan?</label>
          <textarea
            id="deskripsi-makanan"
            name="teks_input"
            value={teks}
            onChange={(event) => {
              setTeks(event.target.value);
              setGalat("");
            }}
            placeholder="Nasi ayam panggang 1 porsi, nasi putih 1 porsi, dan tumis sayur 1 porsi."
            className="min-h-24 w-full resize-y rounded-xl border border-green bg-cream px-[15px] py-[11px] text-sm leading-5 placeholder:text-green/75 focus-visible:outline-2 focus-visible:outline-offset-2"
            maxLength={BATAS_TEKS_INPUT}
            readOnly={proses !== null}
            required
          />
        </div>
        <CatatPhotoPicker key={meal?.id ?? "draft"} />
        <Button
          type="submit"
          disabled={proses !== null}
          className="cursor-pointer rounded-xl! text-sm font-semibold text-white! focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-65"
        >
          {proses === "simpan" ? "Menganalisis…" : sudahDicatat ? "Catat lagi" : "Analisis"}
        </Button>
        {galat && <p role="alert" className="text-sm">{galat}</p>}
      </form>

      <section aria-labelledby="judul-analisis" aria-live="polite" aria-busy={proses !== null} className="grid gap-2 rounded-3xl bg-green-light px-4 py-3 ring-1 ring-green/10 ring-inset">
        <h2 id="judul-analisis" className="text-sm font-semibold">Hasil Analisis</h2>
        <div className="grid gap-1 rounded-2xl bg-white p-3 ring-1 ring-green/10 ring-inset">
          {estimasi && meal ? (
            <>
              <h3 className="break-words font-semibold">{hasil?.items.map((item) => item.nama).join(", ") || meal.teks_input}</h3>
              <dl className="grid gap-1 text-[13px]">
                {nutrisi.map(({ key, label, unit }) => (
                  <div key={key} className="flex justify-between gap-2">
                    <dt>{label}</dt>
                    <dd className="shrink-0 font-semibold">{formatGizi.format(estimasi[key])} {unit}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs leading-4 text-green/75">
                Angka ini merupakan estimasi berdasarkan porsi yang dicatat.
                {meal.rendah_keyakinan && " Tingkat keyakinan estimasi rendah."}
              </p>
            </>
          ) : meal ? (
            <>
              <p className="text-sm">Makanan sudah dicatat. Estimasi gizi belum tersedia.</p>
              <button
                type="button"
                disabled={proses !== null}
                onClick={() => void analisis("ulangi", () => ulangiEstimasiMakan(meal.id))}
                className="min-h-8 cursor-pointer justify-self-start text-sm font-semibold underline underline-offset-2 disabled:opacity-65"
              >
                {proses === "ulangi" ? "Menganalisis…" : "Coba estimasi lagi"}
              </button>
            </>
          ) : (
            <p className="text-sm">{proses === "simpan" ? "Sedang menghitung estimasi gizi…" : "Hasil estimasi gizi akan tampil di sini."}</p>
          )}
        </div>
      </section>
    </div>
  );
}
