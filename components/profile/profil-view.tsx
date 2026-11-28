"use client";

import Image from "next/image";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

import ProfilEditor, { type ModeEditor } from "@/components/profile/profil-editor";
import Button from "@/components/ui/button";
import { muatProfil, type DataProfil } from "@/lib/profile-client";
import type { StatistikProfil } from "@/lib/services/profile-stats";

const card = "rounded-3xl bg-white p-4 ring-1 ring-green/50 ring-inset";
const fokus = "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2";
const formatAngka = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const target = [
  ["Protein", "protein_target_g"],
  ["Karbohidrat", "karbohidrat_target_g"],
  ["Lemak", "lemak_target_g"],
] as const;
const statistikTiles = [
  { key: "beruntun", label: "hari berturut-turut", icon: "fire", size: 22 },
  { key: "total", label: "total pencatatan", icon: "meal", size: 24 },
] as const;

export default function ProfilView({ statistik }: { statistik: StatistikProfil | null }) {
  const [data, setData] = useState<DataProfil | null>(null);
  const [percobaan, setPercobaan] = useState(0);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [mode, setMode] = useState<ModeEditor | null>(null);
  const [keluar, setKeluar] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    muatProfil(controller.signal).then(setData).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setGalat(error instanceof Error ? error.message : "Profil gagal dimuat.");
      }
    });
    return () => controller.abort();
  }, [percobaan]);

  async function logout() {
    setKeluar(true);
    setPesan("");
    try {
      await signOut({ redirectTo: "/login" });
    } catch {
      setPesan("Logout gagal. Coba lagi.");
      setKeluar(false);
    }
  }

  function bukaEditor(editor: ModeEditor) {
    setPesan("");
    setMode(editor);
  }

  return (
    <>
      <h1 className="mb-3.5 text-[28px] leading-[42px] font-bold text-orange">Profil</h1>
      <div className="space-y-3">
        <section aria-label="Profil pengguna" className="space-y-2.5 rounded-3xl bg-green-light p-4 ring-1 ring-green/50 ring-inset">
          <div className="flex items-center justify-between gap-2">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#9b9b9b]">
              <Image src="/assets/profil/user.svg" alt="" width={32} height={32} />
            </span>
            <button
              type="button"
              disabled={!data}
              onClick={() => bukaEditor("profil")}
              className={`${fokus} inline-flex min-h-10 items-center gap-2 rounded-xl bg-orange px-4 py-2.5 text-sm font-semibold text-cream underline hover:brightness-95 disabled:cursor-default disabled:opacity-60`}
            >
              <Image src="/assets/profil/edit.svg" alt="" width={16} height={16} />
              Ubah Profil
            </button>
          </div>
          {data ? (
            <div className="space-y-1 [overflow-wrap:anywhere]">
              <h2 className="text-xl leading-7 font-bold">{data.user.nama}</h2>
              <p className="text-[13px] leading-[19px]">{data.user.email}</p>
            </div>
          ) : galat ? (
            <div className="text-sm">
              <p role="alert">{galat}</p>
              <button type="button" className={`${fokus} mt-1 underline`} onClick={() => { setGalat(""); setPercobaan((n) => n + 1); }}>Coba lagi</button>
            </div>
          ) : <p role="status" className="min-h-[51px] text-sm">Memuat profil…</p>}
        </section>

        <section aria-labelledby="target-profil" className={`${card} grid gap-2.5 pb-1.5`}>
          <div className="flex items-center justify-between gap-2">
            <h2 id="target-profil" className="text-lg font-bold">Target Harian</h2>
            <button
              type="button"
              disabled={!data}
              aria-label="Ubah target harian"
              className={`${fokus} text-sm font-semibold text-orange underline disabled:cursor-default disabled:opacity-60`}
              onClick={() => bukaEditor("target")}
            >
              Ubah
            </button>
          </div>
          <dl className="grid gap-2">
            {target.map(([label, key]) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <dt className="font-medium">{label}</dt>
                <dd className="grid min-h-[30px] min-w-[100px] place-items-center rounded-lg bg-green-light px-2 text-sm font-semibold">
                  {data?.nutrition_target ? `${formatAngka.format(data.nutrition_target[key])} g` : "—"}
                </dd>
              </div>
            ))}
          </dl>
          {data && !data.nutrition_target && <p className="pb-2 text-xs">Lengkapi data tubuh untuk menghitung target harian.</p>}
        </section>

        <section aria-labelledby="jadwal-profil" className={`${card} grid gap-2`}>
          <h2 id="jadwal-profil" className="text-lg font-bold">Input Jadwal</h2>
          <button
            type="button"
            aria-label="Tambah jadwal kuliah"
            className={`${fokus} grid min-h-10 place-items-center rounded-2xl bg-cream hover:brightness-95`}
            onClick={() => bukaEditor("jadwal")}
          >
            <Image src="/assets/profil/calendar.svg" alt="" width={32} height={32} />
          </button>
        </section>

        <section aria-labelledby="statistik-profil" className={`${card} grid gap-2`}>
          <h2 id="statistik-profil" className="text-lg font-bold">Statistik</h2>
          <dl className="grid grid-cols-2 gap-2 sm:gap-4 min-[360px]:gap-4">
            {statistikTiles.map(({ key, label, icon, size }) => (
              <div key={key} className="flex min-h-[84px] min-w-0 items-center gap-1.5 rounded-2xl bg-green-light px-2.5 py-1.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cream">
                  <Image src={`/assets/profil/${icon}.svg`} alt="" width={size} height={size} />
                </span>
                <div className="flex min-w-0 flex-col-reverse gap-0.5">
                  <dt className="max-w-[83px] text-[11px] leading-4 font-medium [overflow-wrap:anywhere]">{label}</dt>
                  <dd className="text-center text-2xl font-bold [overflow-wrap:anywhere]">{statistik ? formatAngka.format(statistik[key]) : "—"}</dd>
                </div>
              </div>
            ))}
          </dl>
          {!statistik && <p className="text-xs">Statistik belum bisa dimuat.</p>}
        </section>
      </div>

      {pesan && <p role="status" className="mt-3 text-sm">{pesan}</p>}
      <Button type="button" disabled={keluar} onClick={() => void logout()} className={`${fokus} mt-4 h-[46px]! rounded-2xl! bg-orange! font-bold hover:brightness-95 disabled:opacity-60`}>
        {keluar ? "Sedang keluar…" : "Logout"}
      </Button>
      {mode && <ProfilEditor mode={mode} pengguna={data?.user} onClose={() => setMode(null)} onSaved={(hasil) => {
        if (hasil) setData(hasil);
        setPesan(mode === "jadwal" ? "Jadwal berhasil ditambahkan." : "Perubahan berhasil disimpan.");
        setMode(null);
      }} />}
    </>
  );
}
