import { describe, expect, it, vi } from "vitest";

import { buatCheckin, type DbCheckin } from "@/lib/services/meal-checkin";

function buatDb(opsi: { mealAda?: boolean; galatCreate?: unknown } = {}) {
  const findFirst = vi.fn().mockResolvedValue(opsi.mealAda === false ? null : { id: "m1" });
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    if (opsi.galatCreate) throw opsi.galatCreate;
    return { id: "c1", waktu: new Date("2026-11-21T05:00:00.000Z"), ...data };
  });
  const db = { mealLog: { findFirst }, checkin: { create } } as unknown as DbCheckin;
  return { db, findFirst, create };
}

const input = { meal_log_id: "m1", tingkat_energi: 4, tingkat_fokus: 3, catatan: "segar" };

describe("buatCheckin", () => {
  it("menyimpan check-in untuk catatan makan milik pengguna", async () => {
    const { db, create } = buatDb();

    const hasil = await buatCheckin("u1", input, db);

    if (hasil.status !== "tersimpan") throw new Error("harus tersimpan");
    expect(hasil.checkin).toEqual({
      id: "c1",
      meal_log_id: "m1",
      tingkat_energi: 4,
      tingkat_fokus: 3,
      catatan: "segar",
      waktu: "2026-11-21T05:00:00.000Z",
    });
    expect(create.mock.calls[0]?.[0].data.user_id).toBe("u1");
  });

  it("kepemilikan dicek lewat user_id di query meal_log", async () => {
    const { db, findFirst } = buatDb();

    await buatCheckin("u1", input, db);

    expect(findFirst.mock.calls[0]?.[0].where).toEqual({ id: "m1", user_id: "u1" });
  });

  it("meal_log yang bukan milik pengguna atau tidak ada: tidak membuat check-in", async () => {
    const { db, create } = buatDb({ mealAda: false });

    const hasil = await buatCheckin("u1", input, db);

    expect(hasil).toEqual({ status: "meal_tidak_ditemukan" });
    expect(create).not.toHaveBeenCalled();
  });

  it("check-in kedua untuk meal_log yang sama (P2002): sudah_ada", async () => {
    const { db } = buatDb({ galatCreate: Object.assign(new Error("unik"), { code: "P2002" }) });

    expect(await buatCheckin("u1", input, db)).toEqual({ status: "sudah_ada" });
  });

  it("catatan kosong disimpan sebagai null", async () => {
    const { db, create } = buatDb();

    await buatCheckin("u1", { meal_log_id: "m1", tingkat_energi: 2, tingkat_fokus: 2 }, db);

    expect(create.mock.calls[0]?.[0].data.catatan).toBeNull();
  });

  it("galat basis data lain diteruskan", async () => {
    const { db } = buatDb({ galatCreate: Object.assign(new Error("mati"), { code: "P1001" }) });

    await expect(buatCheckin("u1", input, db)).rejects.toMatchObject({ code: "P1001" });
  });
});
