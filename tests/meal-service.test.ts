import { beforeEach, describe, expect, it, vi } from "vitest";

const estimasiMock = vi.fn();
vi.mock("@/lib/services/nutrition-estimate", () => ({
  dapatkanEstimasiGizi: (teks: string) => estimasiMock(teks),
}));

import {
  AMBANG_KEYAKINAN_RENDAH,
  apakahKeyakinanRendah,
  cariCatatanTanpaEstimasi,
  catatMakan,
  reprosesEstimasi,
  reprosesSemuaTertunda,
  riwayatMakanHarian,
  type DbMeal,
} from "@/lib/services/meal";

interface Baris {
  id: string;
  user_id: string;
  vendor_id: string | null;
  teks_input: string;
  total_harga: number | null;
  waktu_makan: Date;
  dibuat_pada: Date;
  nutrition_estimate: Record<string, unknown> | null;
  checkin: { id: string } | null;
}

function galatPrisma(code: string) {
  return Object.assign(new Error(`prisma ${code}`), { code });
}

/** Basis data tiruan di memori: cukup untuk operasi `mealLog` yang dipakai service. */
function buatDb(opsi: { vendorAda?: boolean; awal?: Baris[] } = {}) {
  const baris: Baris[] = [...(opsi.awal ?? [])];
  let urut = 0;

  const mealLog = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (data.vendor_id && opsi.vendorAda === false) throw galatPrisma("P2003");
      const b: Baris = {
        id: `meal-${++urut}`,
        user_id: data.user_id as string,
        vendor_id: (data.vendor_id as string | null) ?? null,
        teks_input: data.teks_input as string,
        total_harga: (data.total_harga as number | null) ?? null,
        waktu_makan: data.waktu_makan as Date,
        dibuat_pada: new Date("2026-11-21T05:00:00.000Z"),
        nutrition_estimate: null,
        checkin: null,
      };
      baris.push(b);
      return { id: b.id };
    }),
    update: vi.fn(
      async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const b = baris.find((x) => x.id === where.id)!;
        if (data.total_harga !== undefined) b.total_harga = data.total_harga as number;
        const nested = data.nutrition_estimate as { create: Record<string, unknown> } | undefined;
        if (nested) {
          if (b.nutrition_estimate) throw galatPrisma("P2002");
          b.nutrition_estimate = nested.create;
        }
        return b;
      },
    ),
    findFirst: vi.fn(async ({ where }: { where: { id: string; user_id: string } }) => {
      return baris.find((x) => x.id === where.id && x.user_id === where.user_id) ?? null;
    }),
    findMany: vi.fn(
      async ({
        where,
        take,
      }: {
        where: {
          user_id: string;
          waktu_makan?: { gte: Date; lt: Date };
          nutrition_estimate?: unknown;
        };
        take?: number;
      }) => {
        let hasil = baris.filter((x) => x.user_id === where.user_id);
        if (where.waktu_makan) {
          const { gte, lt } = where.waktu_makan;
          hasil = hasil.filter((x) => x.waktu_makan >= gte && x.waktu_makan < lt);
        }
        if (where.nutrition_estimate) hasil = hasil.filter((x) => x.nutrition_estimate === null);
        return take ? hasil.slice(0, take) : hasil;
      },
    ),
  };

  return { db: { mealLog } as unknown as DbMeal, mealLog, baris };
}

function estimasiBerhasil(opsi: { keyakinan?: number; harga?: number } = {}) {
  return {
    status: "berhasil" as const,
    estimasi: {
      kalori_estimasi: 520,
      protein_g: 14.5,
      karbohidrat_g: 78,
      lemak_g: 15.2,
      zat_besi_mg: 2.1,
      tingkat_keyakinan: opsi.keyakinan ?? 0.72,
      model_versi: "gpt-kobi@prompt-v1",
    },
    estimasi_harga: opsi.harga ?? 12000,
    items: [{ nama: "nasi putih", porsi: "1 piring" }],
  };
}

const WAKTU = new Date("2026-11-21T05:30:00.000Z");
const input = { teks_input: "nasi telur dan es teh", waktu_makan: WAKTU };

beforeEach(() => {
  estimasiMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("apakahKeyakinanRendah", () => {
  it("rendah bila di bawah ambang, tidak rendah pada atau di atas ambang", () => {
    expect(AMBANG_KEYAKINAN_RENDAH).toBe(0.5);
    expect(apakahKeyakinanRendah(0.49)).toBe(true);
    expect(apakahKeyakinanRendah(AMBANG_KEYAKINAN_RENDAH)).toBe(false);
    expect(apakahKeyakinanRendah(0.9)).toBe(false);
  });

  it("estimasi yang tidak ada bukan keyakinan rendah", () => {
    expect(apakahKeyakinanRendah(null)).toBe(false);
    expect(apakahKeyakinanRendah(undefined)).toBe(false);
  });
});

describe("catatMakan", () => {
  it("menyimpan catatan lebih dulu, lalu estimasi lengkap dengan model_versi dan keyakinan", async () => {
    const { db, mealLog } = buatDb();
    estimasiMock.mockImplementation(async () => {
      // Saat estimasi dipanggil, catatan sudah tersimpan.
      expect(mealLog.create).toHaveBeenCalledTimes(1);
      expect(mealLog.update).not.toHaveBeenCalled();
      return estimasiBerhasil();
    });

    const hasil = await catatMakan("u1", input, db);

    if (hasil.status !== "tersimpan") throw new Error("harus tersimpan");
    expect(hasil.catatan.estimasi_tertunda).toBe(false);
    expect(hasil.catatan.rendah_keyakinan).toBe(false);
    expect(hasil.catatan.estimasi).toMatchObject({
      kalori_estimasi: 520,
      protein_g: 14.5,
      tingkat_keyakinan: 0.72,
      model_versi: "gpt-kobi@prompt-v1",
    });
    expect(hasil.items).toEqual([{ nama: "nasi putih", porsi: "1 piring" }]);
    expect(mealLog.create.mock.calls[0]?.[0].data.user_id).toBe("u1");
    expect(estimasiMock).toHaveBeenCalledWith("nasi telur dan es teh");
  });

  it("total_harga kosong diisi estimasi_harga model", async () => {
    const { db } = buatDb();
    estimasiMock.mockResolvedValue(estimasiBerhasil({ harga: 12000 }));

    const hasil = await catatMakan("u1", input, db);

    if (hasil.status !== "tersimpan") throw new Error("harus tersimpan");
    expect(hasil.catatan.total_harga).toBe(12000);
  });

  it("total_harga dari pengguna dipertahankan, termasuk 0", async () => {
    const { db } = buatDb();
    estimasiMock.mockResolvedValue(estimasiBerhasil({ harga: 12000 }));

    const a = await catatMakan("u1", { ...input, total_harga: 8000 }, db);
    const b = await catatMakan("u1", { ...input, total_harga: 0 }, db);

    if (a.status !== "tersimpan" || b.status !== "tersimpan") throw new Error("harus tersimpan");
    expect(a.catatan.total_harga).toBe(8000);
    expect(b.catatan.total_harga).toBe(0);
  });

  it("estimasi_harga 0 dari model tidak mengisi total_harga", async () => {
    const { db } = buatDb();
    estimasiMock.mockResolvedValue(estimasiBerhasil({ harga: 0 }));

    const hasil = await catatMakan("u1", input, db);

    if (hasil.status !== "tersimpan") throw new Error("harus tersimpan");
    expect(hasil.catatan.total_harga).toBeNull();
  });

  it("estimasi gagal: catatan tetap tersimpan dan ditandai tertunda", async () => {
    const { db, baris } = buatDb();
    estimasiMock.mockResolvedValue({ status: "tanpa_estimasi" });

    const hasil = await catatMakan("u1", input, db);

    if (hasil.status !== "tersimpan") throw new Error("harus tersimpan");
    expect(baris).toHaveLength(1);
    expect(hasil.catatan.estimasi).toBeNull();
    expect(hasil.catatan.estimasi_tertunda).toBe(true);
    expect(hasil.catatan.rendah_keyakinan).toBe(false);
    expect(hasil.items).toEqual([]);
  });

  it("estimasi yang melempar galat tak terduga tetap tidak menghilangkan catatan", async () => {
    const { db, baris } = buatDb();
    estimasiMock.mockRejectedValue(new Error("meledak"));

    const hasil = await catatMakan("u1", input, db);

    if (hasil.status !== "tersimpan") throw new Error("harus tersimpan");
    expect(baris).toHaveLength(1);
    expect(hasil.catatan.estimasi_tertunda).toBe(true);
  });

  it("gagal menyimpan estimasi: catatan tetap ada sebagai tertunda", async () => {
    const { db, mealLog, baris } = buatDb();
    estimasiMock.mockResolvedValue(estimasiBerhasil());
    mealLog.update.mockRejectedValueOnce(new Error("timeout tulis"));

    const hasil = await catatMakan("u1", input, db);

    if (hasil.status !== "tersimpan") throw new Error("harus tersimpan");
    expect(baris).toHaveLength(1);
    expect(hasil.catatan.estimasi_tertunda).toBe(true);
    expect(hasil.items).toEqual([]);
  });

  it("keyakinan di bawah ambang menandai rendah_keyakinan tetapi estimasi tetap disimpan", async () => {
    const { db } = buatDb();
    estimasiMock.mockResolvedValue(estimasiBerhasil({ keyakinan: 0.3 }));

    const hasil = await catatMakan("u1", input, db);

    if (hasil.status !== "tersimpan") throw new Error("harus tersimpan");
    expect(hasil.catatan.rendah_keyakinan).toBe(true);
    expect(hasil.catatan.estimasi_tertunda).toBe(false);
    expect(hasil.catatan.estimasi?.tingkat_keyakinan).toBe(0.3);
  });

  it("vendor_id yang tidak ada (FK P2003): status vendor_tidak_valid tanpa memanggil estimasi", async () => {
    const { db, baris } = buatDb({ vendorAda: false });

    const hasil = await catatMakan("u1", { ...input, vendor_id: "ada-di-mana" }, db);

    expect(hasil).toEqual({ status: "vendor_tidak_valid" });
    expect(baris).toHaveLength(0);
    expect(estimasiMock).not.toHaveBeenCalled();
  });

  it("galat basis data lain dari penyimpanan catatan diteruskan, bukan ditelan", async () => {
    const { db, mealLog } = buatDb();
    mealLog.create.mockRejectedValueOnce(galatPrisma("P1001"));

    await expect(catatMakan("u1", input, db)).rejects.toMatchObject({ code: "P1001" });
    expect(estimasiMock).not.toHaveBeenCalled();
  });
});

describe("reprosesEstimasi", () => {
  async function catatanTertunda(userId = "u1") {
    const dbx = buatDb();
    estimasiMock.mockResolvedValueOnce({ status: "tanpa_estimasi" });
    const hasil = await catatMakan(userId, input, dbx.db);
    if (hasil.status !== "tersimpan") throw new Error("harus tersimpan");
    return { ...dbx, id: hasil.catatan.id };
  }

  it("mengisi estimasi catatan tertunda milik pengguna", async () => {
    const { db, id } = await catatanTertunda();
    estimasiMock.mockResolvedValue(estimasiBerhasil());

    const hasil = await reprosesEstimasi("u1", id, db);

    if (hasil.status !== "diproses") throw new Error("harus diproses");
    expect(hasil.catatan.estimasi_tertunda).toBe(false);
    expect(hasil.catatan.estimasi?.model_versi).toBe("gpt-kobi@prompt-v1");
    expect(hasil.catatan.total_harga).toBe(12000);
    expect(hasil.items).toHaveLength(1);
  });

  it("idempoten: catatan yang sudah punya estimasi tidak memanggil AI lagi", async () => {
    const { db, id, mealLog } = await catatanTertunda();
    estimasiMock.mockResolvedValue(estimasiBerhasil());
    await reprosesEstimasi("u1", id, db);
    estimasiMock.mockClear();
    mealLog.update.mockClear();

    const lagi = await reprosesEstimasi("u1", id, db);

    expect(lagi.status).toBe("sudah_ada");
    expect(estimasiMock).not.toHaveBeenCalled();
    expect(mealLog.update).not.toHaveBeenCalled();
  });

  it("tidak menimpa total_harga yang diisi pengguna", async () => {
    const dbx = buatDb();
    estimasiMock.mockResolvedValueOnce({ status: "tanpa_estimasi" });
    const dicatat = await catatMakan("u1", { ...input, total_harga: 9000 }, dbx.db);
    if (dicatat.status !== "tersimpan") throw new Error("harus tersimpan");
    estimasiMock.mockResolvedValue(estimasiBerhasil({ harga: 12000 }));

    const hasil = await reprosesEstimasi("u1", dicatat.catatan.id, dbx.db);

    if (hasil.status !== "diproses") throw new Error("harus diproses");
    expect(hasil.catatan.total_harga).toBe(9000);
  });

  it("catatan milik pengguna lain sama dengan tidak ada, dan AI tidak dipanggil", async () => {
    const { db, id } = await catatanTertunda("pemilik");

    const hasil = await reprosesEstimasi("orang-lain", id, db);

    expect(hasil).toEqual({ status: "tidak_ditemukan" });
    expect(estimasiMock).toHaveBeenCalledTimes(1); // hanya panggilan saat mencatat
  });

  it("id yang tidak ada: tidak_ditemukan", async () => {
    const { db } = buatDb();
    expect(await reprosesEstimasi("u1", "tidak-ada", db)).toEqual({ status: "tidak_ditemukan" });
  });

  it("estimasi gagal lagi: tetap tertunda dan tidak menulis apa pun", async () => {
    const { db, id, mealLog } = await catatanTertunda();
    estimasiMock.mockResolvedValue({ status: "tanpa_estimasi" });

    const hasil = await reprosesEstimasi("u1", id, db);

    if (hasil.status !== "tanpa_estimasi") throw new Error("harus tanpa_estimasi");
    expect(hasil.catatan.estimasi_tertunda).toBe(true);
    expect(mealLog.update).not.toHaveBeenCalled();
  });

  it("kalah balapan (P2002): membaca estimasi pemenang, bukan galat", async () => {
    const { db, id, mealLog, baris } = await catatanTertunda();
    estimasiMock.mockResolvedValue(estimasiBerhasil());
    mealLog.update.mockImplementationOnce(async () => {
      // Permintaan lain menulis lebih dulu, lalu tulisan ini bentrok.
      baris[0]!.nutrition_estimate = { ...estimasiBerhasil().estimasi };
      throw galatPrisma("P2002");
    });

    const hasil = await reprosesEstimasi("u1", id, db);

    expect(hasil.status).toBe("sudah_ada");
  });
});

describe("cariCatatanTanpaEstimasi dan reprosesSemuaTertunda", () => {
  it("hanya mengembalikan catatan milik pengguna yang belum punya estimasi", async () => {
    const dbx = buatDb();
    estimasiMock.mockResolvedValueOnce(estimasiBerhasil()); // u1 punya estimasi
    await catatMakan("u1", input, dbx.db);
    estimasiMock.mockResolvedValueOnce({ status: "tanpa_estimasi" }); // u1 tertunda
    await catatMakan("u1", { ...input, teks_input: "gudeg" }, dbx.db);
    estimasiMock.mockResolvedValueOnce({ status: "tanpa_estimasi" }); // milik u2
    await catatMakan("u2", { ...input, teks_input: "soto" }, dbx.db);

    const tertunda = await cariCatatanTanpaEstimasi("u1", 10, dbx.db);

    expect(tertunda.map((t) => t.teks_input)).toEqual(["gudeg"]);
  });

  it("memproses ulang semua yang tertunda dan melaporkan yang masih gagal", async () => {
    const dbx = buatDb();
    estimasiMock.mockResolvedValue({ status: "tanpa_estimasi" });
    await catatMakan("u1", { ...input, teks_input: "gudeg" }, dbx.db);
    await catatMakan("u1", { ...input, teks_input: "soto" }, dbx.db);

    estimasiMock.mockReset();
    estimasiMock
      .mockResolvedValueOnce(estimasiBerhasil())
      .mockResolvedValueOnce({ status: "tanpa_estimasi" });

    const ringkasan = await reprosesSemuaTertunda("u1", 10, dbx.db);

    expect(ringkasan).toEqual({ diperiksa: 2, berhasil: 1, masihTertunda: 1 });
  });

  it("menghormati batas jumlah catatan", async () => {
    const dbx = buatDb();
    estimasiMock.mockResolvedValue({ status: "tanpa_estimasi" });
    for (const t of ["a", "b", "c"]) await catatMakan("u1", { ...input, teks_input: t }, dbx.db);

    const tertunda = await cariCatatanTanpaEstimasi("u1", 2, dbx.db);

    expect(tertunda).toHaveLength(2);
  });
});

describe("riwayatMakanHarian", () => {
  function barisMeal(id: string, waktu: string, extra: Partial<Baris> = {}): Baris {
    return {
      id,
      user_id: "u1",
      vendor_id: null,
      teks_input: id,
      total_harga: null,
      waktu_makan: new Date(waktu),
      dibuat_pada: new Date(waktu),
      nutrition_estimate: null,
      checkin: null,
      ...extra,
    };
  }

  it("memakai batas hari WIB dan hanya milik pengguna itu", async () => {
    const { db, mealLog } = buatDb({
      awal: [
        barisMeal("dalam", "2026-11-20T17:00:00.000Z"), // 00:00 WIB 21 Nov
        barisMeal("luar", "2026-11-21T17:00:00.000Z"), // 00:00 WIB 22 Nov
        barisMeal("kemarin", "2026-11-20T16:59:00.000Z"),
      ],
    });

    const hasil = await riwayatMakanHarian("u1", "2026-11-21", db);

    expect(hasil.meals.map((m) => m.id)).toEqual(["dalam"]);
    const where = mealLog.findMany.mock.calls[0]?.[0].where;
    expect(where.user_id).toBe("u1");
    expect(where.waktu_makan?.gte.toISOString()).toBe("2026-11-20T17:00:00.000Z");
    expect(where.waktu_makan?.lt.toISOString()).toBe("2026-11-21T17:00:00.000Z");
  });

  it("menandai estimasi_tertunda, rendah_keyakinan, dan sudah_checkin per item", async () => {
    const { db } = buatDb({
      awal: [
        barisMeal("tertunda", "2026-11-21T01:00:00.000Z"),
        barisMeal("rendah", "2026-11-21T02:00:00.000Z", {
          nutrition_estimate: {
            kalori_estimasi: 300,
            protein_g: "5.00",
            karbohidrat_g: "40.00",
            lemak_g: "8.00",
            zat_besi_mg: "1.00",
            tingkat_keyakinan: "0.30",
            model_versi: "m",
          },
          checkin: { id: "c1" },
        }),
      ],
    });

    const { meals } = await riwayatMakanHarian("u1", "2026-11-21", db);
    const tertunda = meals.find((m) => m.id === "tertunda")!;
    const rendah = meals.find((m) => m.id === "rendah")!;

    expect(tertunda).toMatchObject({
      estimasi_tertunda: true,
      rendah_keyakinan: false,
      sudah_checkin: false,
    });
    expect(rendah).toMatchObject({
      estimasi_tertunda: false,
      rendah_keyakinan: true,
      sudah_checkin: true,
    });
    expect(rendah.estimasi?.protein_g).toBe(5); // Decimal jadi number
  });
});
