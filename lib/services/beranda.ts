import { prisma } from "@/lib/db";
import { dateKeJamStr } from "@/lib/db-time";
import { dapatkanGiziHarian } from "@/lib/services/daily-nutrition";
import { rentangMingguWIB } from "@/lib/services/trend-insight";
import { rentangHariWIB } from "@/lib/time-wib";

const satuHari = 86_400_000;
const formatJam = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export async function dapatkanBeranda(userId: string, sekarang = new Date()) {
  const hari = rentangHariWIB(sekarang);
  const { awal: awalMinggu } = rentangMingguWIB(hari.tanggal);

  const [gizi, catatan, jadwal, rekomendasi] = await Promise.all([
    dapatkanGiziHarian(userId, hari.tanggal),
    prisma.mealLog.findMany({
      where: { user_id: userId, waktu_makan: { gte: awalMinggu, lt: hari.akhir } },
      orderBy: [{ waktu_makan: "desc" }, { id: "desc" }],
      select: {
        id: true,
        waktu_makan: true,
        nutrition_estimate: { select: { kalori_estimasi: true } },
        checkin: { select: { id: true } },
      },
    }),
    prisma.classSchedule.findMany({ where: { user_id: userId } }),
    prisma.recommendation.findFirst({
      where: { user_id: userId },
      orderBy: [{ waktu_dibuat: "desc" }, { id: "desc" }],
      select: {
        jarak_meter: true,
        sela_waktu_menit: true,
        vendor: { select: { nama_warung: true } },
        menu_item: {
          select: { nama_menu: true, estimasi_harga: true, estimasi_kalori: true, estimasi_protein_g: true },
        },
      },
    }),
  ]);

  const kaloriHarian = new Map<string, number>();
  for (const makan of catatan) {
    if (!makan.nutrition_estimate) continue;
    const { tanggal } = rentangHariWIB(makan.waktu_makan);
    kaloriHarian.set(tanggal, (kaloriHarian.get(tanggal) ?? 0) + makan.nutrition_estimate.kalori_estimasi);
  }

  const progres = Array.from({ length: 7 }, (_, i) => {
    const { tanggal } = rentangHariWIB(new Date(awalMinggu.getTime() + i * satuHari));
    return { tanggal, kalori: kaloriHarian.get(tanggal) ?? null };
  });

  const jamSekarang = formatJam.format(sekarang).replace(".", ":");
  const hariMinggu = new Date(`${hari.tanggal}T00:00:00Z`).getUTCDay() || 7;
  const berikutnya = jadwal.map((kelas) => {
    const mulai = dateKeJamStr(kelas.jam_mulai) ?? "";
    const selisih = (kelas.hari - hariMinggu + 7) % 7;
    return {
      nama: kelas.mata_kuliah,
      ruang: kelas.lokasi_ruang,
      mulai,
      selesai: dateKeJamStr(kelas.jam_selesai) ?? "",
      hari: kelas.hari,
      selisih: selisih === 0 && mulai <= jamSekarang ? 7 : selisih,
    };
  }).sort((a, b) => a.selisih - b.selisih || a.mulai.localeCompare(b.mulai))[0];

  const makanHariIni = catatan.filter((makan) => makan.waktu_makan >= hari.awal);
  const belumCheckin = makanHariIni.find((makan) => !makan.checkin);
  const menu = rekomendasi?.menu_item;

  return {
    gizi,
    progres,
    jadwal: berikutnya ?? null,
    checkin: {
      id: belumCheckin?.id ?? null,
      jam: belumCheckin ? formatJam.format(belumCheckin.waktu_makan) : null,
      sudahLengkap: makanHariIni.length > 0 && !belumCheckin,
    },
    rekomendasi: rekomendasi && menu ? {
      nama: menu.nama_menu,
      warung: rekomendasi.vendor.nama_warung,
      harga: menu.estimasi_harga,
      kalori: menu.estimasi_kalori,
      protein: menu.estimasi_protein_g === null ? null : Number(menu.estimasi_protein_g),
      jarak: rekomendasi.jarak_meter,
      sela: rekomendasi.sela_waktu_menit,
    } : null,
  };
}

export type DataBeranda = Awaited<ReturnType<typeof dapatkanBeranda>>;
