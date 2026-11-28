"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const sumberFoto = [
  { label: "Ambil foto", capture: "environment", icon: "camera", width: 46, height: 46 },
  { label: "Pilih dari galeri", capture: undefined, icon: "gallery", width: 36.979, height: 33.5269 },
] as const;

export default function CatatPhotoPicker() {
  const [preview, setPreview] = useState("");
  const [galat, setGalat] = useState("");

  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-sm leading-5">Tambah foto (opsional)</legend>
      <div className="grid max-w-[294px] grid-cols-2 gap-3.5">
        {sumberFoto.map(({ label, capture, icon, width, height }) => (
          <label key={icon} className="relative flex min-h-24 min-w-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-green bg-green-light px-1 text-center text-sm leading-5 hover:bg-green/15 focus-within:outline-2 focus-within:outline-offset-2">
            <input
              type="file"
              accept="image/*"
              capture={capture}
              className="sr-only"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                if (!file.type.startsWith("image/")) {
                  setGalat("Pilih berkas gambar.");
                  return;
                }
                setGalat("");
                setPreview(URL.createObjectURL(file));
              }}
            />
            <span className={icon === "gallery" ? "grid h-[42px] place-items-center" : undefined}>
              <Image src={`/assets/catat/${icon}.svg`} alt="" width={width} height={height} unoptimized />
            </span>
            {label}
          </label>
        ))}
      </div>
      {galat && <p role="alert" className="mt-2 text-xs">{galat}</p>}
      {preview && (
        <div className="mt-3 space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- Browser-local object URL. */}
          <img
            src={preview}
            alt="Pratinjau foto makanan"
            className="max-h-40 w-full rounded-xl bg-cream object-contain"
            onError={() => {
              setPreview("");
              setGalat("Foto ini tidak bisa ditampilkan. Pilih gambar lain.");
            }}
          />
          <p className="text-xs">Foto hanya ditampilkan di perangkat ini. Analisis menggunakan deskripsi makanan.</p>
          <button
            type="button"
            className="min-h-8 cursor-pointer text-sm font-semibold underline underline-offset-2"
            onClick={() => {
              setPreview("");
              setGalat("");
            }}
          >
            Hapus foto
          </button>
        </div>
      )}
    </fieldset>
  );
}
