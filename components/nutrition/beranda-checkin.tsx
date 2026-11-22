"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import BerandaCard from "@/components/nutrition/beranda-card";
import type { DataBeranda } from "@/lib/services/beranda";

const pilihan = [{ label: "Low", nilai: 1 }, { label: "Mid", nilai: 3 }, { label: "High", nilai: 5 }];

export default function BerandaCheckin({
  data,
}: {
  data: DataBeranda["checkin"];
}) {
  const router = useRouter();
  const [menyimpan, setMenyimpan] = useState(false);
  const [pesan, setPesan] = useState("");
  const [selesai, setSelesai] = useState(false);

  async function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (menyimpan || selesai) return;
    if (!data.id) return;

    const nilai = new FormData(event.currentTarget);
    setMenyimpan(true);
    setPesan("");
    try {
      const hasil = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal_log_id: data.id,
          tingkat_energi: Number(nilai.get("energi")),
          tingkat_fokus: Number(nilai.get("fokus")),
        }),
      });

      if (!hasil.ok) {
        const respons = await hasil.json().catch(() => null);
        setPesan(respons?.error?.message ?? "Check-in gagal disimpan. Coba lagi.");
        if (hasil.status === 409) router.refresh();
        return;
      }
      setSelesai(true);
      setPesan("Check-in tersimpan.");
      router.refresh();
    } catch {
      setPesan("Koneksi bermasalah. Coba lagi.");
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <BerandaCard judul="CheckIn">
      {!data.id ? (
        <p className="text-xs">{data.sudahLengkap ? "Check-in untuk semua catatan makan hari ini sudah lengkap." : "Catat makanan hari ini untuk mengisi check-in."}</p>
      ) : (
        <form onSubmit={simpan} className="space-y-2">
          {data.jam && <p className="text-xs">Catatan makan pukul {data.jam} WIB</p>}
          <fieldset disabled={menyimpan || selesai} className="space-y-2">
            <legend className="sr-only">Kondisi setelah makan</legend>
            {[{ nama: "energi", label: "Energi" }, { nama: "fokus", label: "Fokus" }].map(({ nama, label }) => (
              <div key={nama} role="group" aria-label={label} className="grid grid-cols-[minmax(3rem,3.375rem)_repeat(3,minmax(0,1fr))] items-center gap-2">
                <span className="text-sm font-semibold">{label}</span>
                {pilihan.map(({ label, nilai }) => (
                  <label key={nilai}>
                    <input type="radio" name={nama} value={nilai} required className="peer sr-only" />
                    <span className="grid h-8 cursor-pointer place-items-center rounded-lg bg-[#d9d9d9] text-xs text-green/75 peer-checked:bg-green peer-checked:text-bone peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-green">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            ))}
            <button type="submit" className="h-[38px] w-full rounded-xl bg-green text-sm font-semibold text-bone disabled:opacity-70">
              {menyimpan ? "Menyimpan…" : selesai ? "Tersimpan" : "Simpan"}
            </button>
          </fieldset>
          {pesan && <p role="status" className="text-xs">{pesan}</p>}
        </form>
      )}
    </BerandaCard>
  );
}
