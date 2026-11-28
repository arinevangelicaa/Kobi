"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { simpanProfil, tambahJadwal, type DataProfil, type ProfilUser } from "@/lib/profile-client";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/lib/validation/profile";
import { scheduleCreateSchema } from "@/lib/validation/schedule";

export type ModeEditor = "profil" | "target" | "jadwal";

const judul = { profil: "Ubah Profil", target: "Ubah Target Harian", jadwal: "Input Jadwal" };
const hari = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const kelasSelect = "h-13 w-full rounded-[20px] border border-gray-300 bg-bone px-5";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-sm font-medium">{label}{children}</label>;
}

export default function ProfilEditor({
  mode, pengguna, onClose, onSaved,
}: {
  mode: ModeEditor;
  pengguna?: ProfilUser;
  onClose: () => void;
  onSaved: (data?: DataProfil) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const menyimpan = useRef(false);
  const [pending, setPending] = useState(false);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (menyimpan.current) return;
    const form = new FormData(event.currentTarget);
    const teks = (key: string) => String(form.get(key) ?? "").trim();
    const angka = (key: string) => teks(key) === "" ? null : Number(teks(key));
    const jadwal = mode === "jadwal";

    let simpan: () => Promise<DataProfil | undefined>;
    if (jadwal) {
      const parsed = scheduleCreateSchema.safeParse({
        mata_kuliah: teks("mata_kuliah"), hari: Number(teks("hari")),
        jam_mulai: teks("jam_mulai"), jam_selesai: teks("jam_selesai"),
        lokasi_ruang: teks("lokasi_ruang") || null,
      });
      if (!parsed.success) {
        setGalat(parsed.error.issues[0].message);
        return;
      }
      simpan = async () => {
        await tambahJadwal(parsed.data);
        return undefined;
      };
    } else if (pengguna) {
      const perubahan: ProfileUpdateInput = {};
      if (mode === "profil") {
        const nama = teks("nama");
        const anggaran = angka("preferensi_anggaran");
        if (nama !== pengguna.nama) perubahan.nama = nama;
        if (anggaran !== pengguna.preferensi_anggaran) perubahan.preferensi_anggaran = anggaran;
      } else {
        const lahir = teks("tanggal_lahir") || null;
        const kelamin = teks("jenis_kelamin") as ProfilUser["jenis_kelamin"] | "";
        const berat = angka("berat_badan_kg");
        const tinggi = angka("tinggi_badan_cm");
        if (lahir !== pengguna.tanggal_lahir) perubahan.tanggal_lahir = lahir;
        if ((kelamin || null) !== (pengguna.jenis_kelamin ?? null)) perubahan.jenis_kelamin = kelamin || null;
        if (berat !== pengguna.berat_badan_kg) perubahan.berat_badan_kg = berat;
        if (tinggi !== pengguna.tinggi_badan_cm) perubahan.tinggi_badan_cm = tinggi;
      }
      if (Object.keys(perubahan).length === 0) {
        onClose();
        return;
      }
      const parsed = profileUpdateSchema.safeParse(perubahan);
      if (!parsed.success) {
        setGalat(parsed.error.issues[0].message);
        return;
      }
      simpan = () => simpanProfil(parsed.data);
    } else {
      return;
    }

    menyimpan.current = true;
    setPending(true);
    setGalat("");
    try {
      onSaved(await simpan());
    } catch (error) {
      setGalat(error instanceof Error ? error.message : "Perubahan gagal disimpan.");
    } finally {
      menyimpan.current = false;
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="editor-profil-title"
      onCancel={(event) => { event.preventDefault(); if (!menyimpan.current) onClose(); }}
      className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-3xl bg-bone p-5 text-green shadow-xl backdrop:bg-black/40"
    >
      <h2 id="editor-profil-title" className="mb-4 text-xl font-bold">{judul[mode]}</h2>
      <form method="post" onSubmit={submit} className="grid gap-4">
        <fieldset disabled={pending} className="grid min-w-0 gap-3">
          {mode === "profil" && (
            <>
              <Field label="Nama"><Input name="nama" autoComplete="name" defaultValue={pengguna?.nama} required maxLength={100} /></Field>
              <Field label="Anggaran makan (Rp)"><Input name="preferensi_anggaran" type="number" min={0} step={1} defaultValue={pengguna?.preferensi_anggaran ?? ""} /></Field>
            </>
          )}
          {mode === "target" && (
            <>
              <p className="text-sm">Target dihitung dari data tubuh yang kamu simpan.</p>
              <Field label="Tanggal lahir"><Input name="tanggal_lahir" type="date" defaultValue={pengguna?.tanggal_lahir ?? ""} /></Field>
              <Field label="Jenis kelamin">
                <select name="jenis_kelamin" className={kelasSelect} defaultValue={pengguna?.jenis_kelamin ?? ""}>
                  <option value="">Belum diisi</option>
                  <option value={pengguna?.jenis_kelamin === "laki-laki" ? "laki-laki" : "L"}>Laki-laki</option>
                  <option value={pengguna?.jenis_kelamin === "perempuan" ? "perempuan" : "P"}>Perempuan</option>
                </select>
              </Field>
              <Field label="Berat badan (kg)"><Input name="berat_badan_kg" type="number" step="any" defaultValue={pengguna?.berat_badan_kg ?? ""} /></Field>
              <Field label="Tinggi badan (cm)"><Input name="tinggi_badan_cm" type="number" step="any" defaultValue={pengguna?.tinggi_badan_cm ?? ""} /></Field>
            </>
          )}
          {mode === "jadwal" && (
            <>
              <Field label="Mata kuliah"><Input name="mata_kuliah" required maxLength={150} /></Field>
              <Field label="Hari">
                <select name="hari" className={kelasSelect} defaultValue="" required>
                  <option value="" disabled>Pilih hari</option>
                  {hari.map((nama, index) => <option key={nama} value={index + 1}>{nama}</option>)}
                </select>
              </Field>
              <Field label="Jam mulai"><Input name="jam_mulai" type="time" required /></Field>
              <Field label="Jam selesai"><Input name="jam_selesai" type="time" required /></Field>
              <Field label="Lokasi ruang (opsional)"><Input name="lokasi_ruang" maxLength={100} /></Field>
            </>
          )}
        </fieldset>
        {galat && <p role="alert" className="text-sm">{galat}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending} className="disabled:opacity-60">Batal</Button>
          <Button type="submit" disabled={pending} className="disabled:opacity-60">{pending ? "Menyimpan…" : "Simpan"}</Button>
        </div>
      </form>
    </dialog>
  );
}
