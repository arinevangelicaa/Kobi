import { describe, expect, it, vi } from "vitest";

import { POST as rekomendasiPost } from "@/app/api/recommendations/route";
import { hitungJarakHaversine } from "@/lib/services/recommendation";

import { buatUser, masukSebagai, pakaiDbBersih, post, prisma } from "./helpers";

pakaiDbBersih();

// Titik pengguna (sekitar Jakarta). 12:00 WIB = 05:00 UTC.
const POSISI = { latitude: -6.2, longitude: 106.8166 };
const WAKTU = "2026-11-21T05:00:00.000Z";

interface InputVendor {
  nama: string;
  latitude: number | null;
  longitude: number | null;
  buka?: string | null;
  tutup?: string | null;
}

/** Jam dimasukkan lewat SQL mentah ('08:00'::time) supaya tidak bergantung pada util aplikasi. */
async function sisipVendor(v: InputVendor): Promise<string> {
  const baris = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO vendors (id, nama_warung, jenis_vendor, alamat, latitude, longitude, jam_buka, jam_tutup)
    VALUES (gen_random_uuid(), ${v.nama}, 'warteg', 'Jl. Uji', ${v.latitude}, ${v.longitude},
            ${v.buka ?? null}::time, ${v.tutup ?? null}::time)
    RETURNING id`;
  return (baris[0] as { id: string }).id;
}

async function sisipMenu(
  vendorId: string,
  nama: string,
  harga: number,
  protein: number | null,
  tersedia = true,
) {
  return prisma.menuItem.create({
    data: {
      vendor_id: vendorId,
      nama_menu: nama,
      estimasi_harga: harga,
      estimasi_kalori: 400,
      estimasi_protein_g: protein,
      tersedia,
    },
  });
}

async function siapkanKatalog() {
  const dekat = await sisipVendor({ nama: "Warteg Dekat", latitude: -6.201, longitude: 106.817, buka: "08:00", tutup: "21:00" });
  const sedang = await sisipVendor({ nama: "Warung 24 Jam", latitude: -6.21, longitude: 106.82 });
  const tutup = await sisipVendor({ nama: "Warung Malam", latitude: -6.2005, longitude: 106.8168, buka: "17:00", tutup: "23:00" });
  const jauh = await sisipVendor({ nama: "Warung Jauh", latitude: -6.5, longitude: 107.2, buka: "08:00", tutup: "21:00" });
  await sisipVendor({ nama: "Tanpa Koordinat", latitude: null, longitude: null });

  const ayam = await sisipMenu(dekat, "Nasi Ayam", 15000, 25.5);
  const esTeh = await sisipMenu(dekat, "Es Teh", 5000, 0);
  await sisipMenu(dekat, "Menu Habis", 9000, 30, false);
  await sisipMenu(dekat, "Steak Mahal", 50000, 40);
  const tempe = await sisipMenu(sedang, "Nasi Tempe", 10000, 12);
  await sisipMenu(tutup, "Nasi Malam", 9000, 20);
  await sisipMenu(jauh, "Nasi Jauh", 9000, 20);

  return { dekat, sedang, tutup, jauh, ayam, esTeh, tempe };
}

const minta = (body: Record<string, unknown>) =>
  rekomendasiPost(
    post("/api/recommendations", {
      ...POSISI,
      batas_anggaran: 20000,
      sela_waktu_menit: 120,
      waktu: WAKTU,
      ...body,
    }),
  );

describe("POST /api/recommendations (Haversine karena Azure Maps tidak dikonfigurasi)", () => {
  it("menyaring vendor/menu dari DB, memakai jarak estimasi, dan menyimpan baris recommendations", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    const katalog = await siapkanKatalog();
    // Azure Maps tidak dikonfigurasi, jadi tidak boleh ada panggilan jaringan sama sekali.
    const fetchTiruan = vi.fn(async () => {
      throw new Error("tidak boleh memanggil jaringan");
    });
    vi.stubGlobal("fetch", fetchTiruan);

    const res = await minta({});
    expect(res.status).toBe(200);
    const badan = await res.json();

    expect(badan.success).toBe(true);
    expect(fetchTiruan).not.toHaveBeenCalled();

    const namaMenu = badan.recommendations.map((r: { nama_menu: string }) => r.nama_menu).sort();
    // Hanya menu tersedia, dalam anggaran, di vendor yang buka, berkoordinat, dan terjangkau.
    expect(namaMenu).toEqual(["Es Teh", "Nasi Ayam", "Nasi Tempe"]);
    expect(badan.count).toBe(3);

    for (const r of badan.recommendations) {
      expect(r.sumber_jarak).toBe("estimasi");
      expect(r.gizi_disasar).toBe("protein");
      expect(r.estimasi_harga).toBeLessThanOrEqual(20000);
      expect(r.total_waktu_dibutuhkan_menit).toBeLessThanOrEqual(120);
    }

    const ayam = badan.recommendations.find((r: { menu_item_id: string }) => r.menu_item_id === katalog.ayam.id);
    expect(ayam.jarak_meter).toBe(hitungJarakHaversine(POSISI, { latitude: -6.201, longitude: 106.817 }));
    expect(ayam).toMatchObject({ vendor_id: katalog.dekat, nama_warung: "Warteg Dekat" });

    // Riwayat tersimpan untuk pengguna yang login, satu baris per rekomendasi.
    const tersimpan = await prisma.recommendation.findMany({ where: { user_id: user.id } });
    expect(tersimpan).toHaveLength(3);
    expect(tersimpan.map((t) => t.menu_item_id).sort()).toEqual(
      badan.recommendations.map((r: { menu_item_id: string }) => r.menu_item_id).sort(),
    );
    for (const t of tersimpan) {
      expect(t).toMatchObject({ status: "ditampilkan", gizi_disasar: "protein", batas_anggaran: 20000, sela_waktu_menit: 120 });
      expect(t.jarak_meter).toBeGreaterThan(0);
    }
  });

  it("jumlah membatasi hasil; yang protein tinggi dan dekat diurutkan lebih dulu", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    const katalog = await siapkanKatalog();

    const badan = await (await minta({ jumlah: 1 })).json();

    expect(badan.count).toBe(1);
    expect(badan.recommendations[0].menu_item_id).toBe(katalog.ayam.id);
    expect(await prisma.recommendation.count()).toBe(1);
  });

  it("anggaran dan sela waktu kecil menyaring semuanya: 200 dengan daftar kosong, tidak ada baris tersimpan", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    await siapkanKatalog();

    const badan = await (await minta({ batas_anggaran: 1000 })).json();

    expect(badan).toMatchObject({ success: true, count: 0, recommendations: [] });
    expect(await prisma.recommendation.count()).toBe(0);
  });

  it("jam operasional memakai WIB: warung yang tutup disaring, yang buka ikut, tanpa jam dianggap buka", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    await siapkanKatalog();

    const warungPada = async (waktu: string) => {
      const badan = await (await minta({ waktu, jumlah: 20 })).json();
      return new Set<string>(badan.recommendations.map((r: { nama_warung: string }) => r.nama_warung));
    };

    // Warteg Dekat 08:00-21:00, Warung Malam 17:00-23:00, Warung 24 Jam tanpa jam.
    // Warung Jauh selalu gugur karena jarak, bukan jam, jadi tidak dipakai sebagai bukti.
    const siang = await warungPada("2026-11-21T05:00:00.000Z"); // 12:00 WIB
    expect(siang).toContain("Warteg Dekat");
    expect(siang).toContain("Warung 24 Jam");
    expect(siang).not.toContain("Warung Malam"); // belum buka

    const sore = await warungPada("2026-11-21T11:00:00.000Z"); // 18:00 WIB
    expect(sore).toContain("Warteg Dekat");
    expect(sore).toContain("Warung Malam");

    const malam = await warungPada("2026-11-21T15:00:00.000Z"); // 22:00 WIB
    expect(malam).not.toContain("Warteg Dekat"); // sudah tutup pukul 21:00
    expect(malam).toContain("Warung Malam");
    expect(malam).toContain("Warung 24 Jam");

    for (const s of [siang, sore, malam]) expect(s).not.toContain("Warung Jauh");
  });

  it("tanpa sesi 401 UNAUTHORIZED: spesifikasi mewajibkan login, tidak ada riwayat dan tidak ada panggilan jaringan", async () => {
    await siapkanKatalog();
    const fetchTiruan = vi.fn(async () => {
      throw new Error("tidak boleh memanggil jaringan");
    });
    vi.stubGlobal("fetch", fetchTiruan);

    const res = await minta({});

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    expect(await prisma.recommendation.count()).toBe(0);
    expect(fetchTiruan).not.toHaveBeenCalled();
  });

  it("400 untuk input tidak valid", async () => {
    masukSebagai((await buatUser()).id);

    const res = await minta({ batas_anggaran: 10 });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });
});
