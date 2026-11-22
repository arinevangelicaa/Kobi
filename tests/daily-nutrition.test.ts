import { describe, expect, it, vi } from "vitest";

import { dapatkanGiziHarian, type DbGizi } from "@/lib/services/daily-nutrition";

// Decimal Prisma dibaca lewat Number(), jadi number biasa cukup sebagai tiruan.
function targetRow(overrides: Record<string, unknown> = {}) {
  return {
    protein_target_g: 60,
    karbohidrat_target_g: 300,
    lemak_target_g: 60,
    zat_besi_target_mg: 11,
    kalori_target: 2200,
    berlaku_sejak: new Date("2026-11-01T00:00:00.000Z"),
    ...overrides,
  };
}

function mealRow(estimasi: Record<string, unknown> | null) {
  return { id: "m", nutrition_estimate: estimasi };
}

function estimasiRow(protein: number, kalori = 500) {
  return {
    protein_g: protein,
    karbohidrat_g: 70,
    lemak_g: 15,
    zat_besi_mg: 2,
    kalori_estimasi: kalori,
  };
}

function buatDb(opsi: { target?: unknown; targetLama?: unknown; meals?: unknown[] }) {
  const findFirst = vi
    .fn()
    // Panggilan pertama: target yang berlaku pada hari itu.
    .mockResolvedValueOnce(opsi.target ?? null)
    // Panggilan kedua (hanya bila pertama kosong): target tertua.
    .mockResolvedValueOnce(opsi.targetLama ?? null);
  const findMany = vi.fn().mockResolvedValue(opsi.meals ?? []);
  const db = {
    nutritionTarget: { findFirst },
    mealLog: { findMany },
  } as unknown as DbGizi;
  return { db, findFirst, findMany };
}

describe("dapatkanGiziHarian", () => {
  it("menjumlahkan estimasi dan menghitung kesenjangan terhadap target", async () => {
    const { db } = buatDb({
      target: targetRow(),
      meals: [mealRow(estimasiRow(20)), mealRow(estimasiRow(15))],
    });

    const gizi = await dapatkanGiziHarian("u1", "2026-11-21", db);

    expect(gizi.tanggal).toBe("2026-11-21");
    expect(gizi.asupan.protein_g).toBe(35);
    expect(gizi.asupan.kalori).toBe(1000);
    expect(gizi.jumlah_catatan).toBe(2);
    expect(gizi.jumlah_tanpa_estimasi).toBe(0);

    const protein = gizi.kesenjangan.find((g) => g.zat === "protein_g");
    expect(protein?.kurang).toBe(25);
  });

  it("catatan tanpa estimasi dihitung terpisah dan tidak ikut akumulasi", async () => {
    const { db } = buatDb({
      target: targetRow(),
      meals: [mealRow(estimasiRow(20)), mealRow(null)],
    });

    const gizi = await dapatkanGiziHarian("u1", "2026-11-21", db);

    expect(gizi.jumlah_catatan).toBe(2);
    expect(gizi.jumlah_tanpa_estimasi).toBe(1);
    expect(gizi.asupan.protein_g).toBe(20);
  });

  it("query memakai batas hari WIB dan hanya milik pengguna itu", async () => {
    const { db, findMany } = buatDb({ target: targetRow() });

    await dapatkanGiziHarian("u1", "2026-11-21", db);

    const where = findMany.mock.calls[0]?.[0].where;
    expect(where.user_id).toBe("u1");
    expect(where.waktu_makan.gte.toISOString()).toBe("2026-11-20T17:00:00.000Z");
    expect(where.waktu_makan.lt.toISOString()).toBe("2026-11-21T17:00:00.000Z");
  });

  it("memilih target yang berlaku pada hari itu, bukan yang terbaru", async () => {
    const { db, findFirst } = buatDb({ target: targetRow() });

    await dapatkanGiziHarian("u1", "2026-11-21", db);

    const where = findFirst.mock.calls[0]?.[0].where;
    expect(where.user_id).toBe("u1");
    expect(where.berlaku_sejak.lte.toISOString()).toBe("2026-11-21T00:00:00.000Z");
  });

  it("jatuh ke target tertua bila semua target dibuat setelah hari itu", async () => {
    const { db, findFirst } = buatDb({
      target: null,
      targetLama: targetRow({ protein_target_g: 55 }),
    });

    const gizi = await dapatkanGiziHarian("u1", "2026-10-01", db);

    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(gizi.target?.protein_g).toBe(55);
  });

  it("tanpa target sama sekali: target null dan kesenjangan kosong, asupan tetap dihitung", async () => {
    const { db } = buatDb({ target: null, targetLama: null, meals: [mealRow(estimasiRow(20))] });

    const gizi = await dapatkanGiziHarian("u1", "2026-11-21", db);

    expect(gizi.target).toBeNull();
    expect(gizi.kesenjangan).toEqual([]);
    expect(gizi.asupan.protein_g).toBe(20);
  });

  it("hari tanpa catatan: asupan nol, kesenjangan penuh", async () => {
    const { db } = buatDb({ target: targetRow(), meals: [] });

    const gizi = await dapatkanGiziHarian("u1", "2026-11-21", db);

    expect(gizi.jumlah_catatan).toBe(0);
    expect(gizi.asupan.protein_g).toBe(0);
    expect(gizi.kesenjangan.find((g) => g.zat === "protein_g")?.kurang).toBe(60);
  });

  it("menolak tanggal tidak valid sebelum menyentuh basis data", async () => {
    const { db, findFirst, findMany } = buatDb({ target: targetRow() });

    await expect(dapatkanGiziHarian("u1", "bukan-tanggal", db)).rejects.toThrow(RangeError);
    expect(findFirst).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
});
