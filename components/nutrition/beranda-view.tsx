import Image from "next/image";

import BerandaCard from "@/components/nutrition/beranda-card";
import BerandaCheckin from "@/components/nutrition/beranda-checkin";
import DailyNutritionCard from "@/components/nutrition/daily-nutrition-card";
import Disclaimer from "@/components/ui/disclaimer";
import type { DataBeranda } from "@/lib/services/beranda";

const formatTanggal = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "full",
  timeZone: "Asia/Jakarta",
});

const angka = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const namaHari = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export default function BerandaView({ data, nama }: {
  data: DataBeranda;
  nama?: string;
}) {
  const { gizi, progres, jadwal, checkin, rekomendasi } = data;
  const kaloriMaks = Math.max(1, gizi.target?.kalori ?? 0, ...progres.map((hari) => hari.kalori ?? 0));

  return (
    <div className="space-y-3">
      <header className="flex items-center gap-3">
        <Image
          src="/assets/beranda/027e7.svg"
          alt=""
          width={71}
          height={67}
          className="-ml-0.5 w-[70.75px] shrink-0"
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold wrap-break-word">
            {nama ? `Hai, ${nama}` : "Hai!"}
          </h1>
          <time dateTime={gizi.tanggal} className="text-sm text-green/75">
            {formatTanggal.format(new Date(`${gizi.tanggal}T00:00:00Z`))}
          </time>
        </div>
      </header>
      <BerandaCard judul="Progres Nutrisi" hijau>
        <ul aria-label="Asupan energi per hari dalam kkal" className="flex h-[97px] items-end gap-2">
          {progres.map(({ tanggal, kalori }) => {
            const [, bulan, hari] = tanggal.split("-");
            const label = `${Number(hari)}/${Number(bulan)}`;
            const nilai = kalori === null ? "belum ada estimasi" : `${angka.format(kalori)} kkal`;
            return (
              <li key={tanggal} title={`${label} · ${nilai}`} className="flex w-[26px] min-w-0 shrink flex-col items-center gap-1.5">
                <span className="sr-only">{label}, {nilai}</span>
                <span aria-hidden="true" className="w-full rounded-sm bg-orange" style={{ height: Math.max(1, (kalori ?? 0) / kaloriMaks * 76) }} />
                {kalori !== null && <span aria-hidden="true" className="text-xxs text-green/70">{label}</span>}
              </li>
            );
          })}
        </ul>
      </BerandaCard>

      <BerandaCheckin key={checkin.id ?? "tanpa-catatan"} data={checkin} />

      <BerandaCard judul="Jadwal berikutnya" hijau>
        {jadwal ? (
          <div className="grid min-h-[28px] grid-cols-3 items-start gap-x-2 gap-y-1 text-xs">
            <p className="wrap-break-word font-semibold">{jadwal.nama}</p>
            <p>{jadwal.mulai.replace(":", ".")}–{jadwal.selesai.replace(":", ".")}</p>
            {jadwal.ruang && <p className="wrap-break-word font-semibold">{jadwal.ruang}</p>}
            {jadwal.selisih > 0 && <p className="col-span-full">{namaHari[jadwal.hari - 1]}{jadwal.selisih === 7 ? " depan" : ""}</p>}
          </div>
        ) : <p className="text-xs">Belum ada jadwal kuliah.</p>}
      </BerandaCard>

      <BerandaCard judul="Rekomendasi terakhir" hijau>
        {rekomendasi ? (
          <div className="flex items-start gap-2.5">
            <div aria-hidden="true" className="size-[72px] shrink-0 rounded-xl bg-[#d9d9d9]" />
            <div className="min-w-0 text-xs leading-[19px]">
              <h3 className="text-sm font-semibold">{rekomendasi.nama}</h3>
              <p>{rekomendasi.warung}{rekomendasi.jarak !== null && ` (${angka.format(rekomendasi.jarak)} m)`}</p>
              <p>{[
                rupiah.format(rekomendasi.harga),
                rekomendasi.kalori !== null && `${angka.format(rekomendasi.kalori)} kkal`,
                rekomendasi.protein !== null && `${angka.format(rekomendasi.protein)} g protein`,
              ].filter(Boolean).join(" | ")}</p>
              <p>Cocok untuk sela {rekomendasi.sela} menit</p>
            </div>
          </div>
        ) : <p className="text-xs">Belum ada rekomendasi tersimpan.</p>}
      </BerandaCard>

      <DailyNutritionCard gizi={gizi} />
      <Disclaimer />
    </div>
  );
}
