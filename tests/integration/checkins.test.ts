import { describe, expect, it } from "vitest";

import { POST as checkinPost } from "@/app/api/checkins/route";
import { GET as mealsGet } from "@/app/api/meals/route";

import { buatUser, get, masukSebagai, pakaiDbBersih, post, prisma } from "./helpers";

pakaiDbBersih();

const UUID_TIDAK_ADA = "3f2b8c1e-9d4a-4e6b-8a1c-2d5f7e9b0a13";

async function penggunaDenganMeal(nama = "Pengguna") {
  const user = await buatUser(nama);
  const meal = await prisma.mealLog.create({
    data: { user_id: user.id, teks_input: "nasi telur", waktu_makan: new Date("2026-11-21T05:00:00Z") },
  });
  return { user, meal };
}

const checkin = (body: Record<string, unknown>) => checkinPost(post("/api/checkins", body));

describe("POST /api/checkins", () => {
  it("201 dan baris tersimpan dengan user_id dari sesi", async () => {
    const { user, meal } = await penggunaDenganMeal();
    masukSebagai(user.id);

    const res = await checkin({ meal_log_id: meal.id, tingkat_energi: 4, tingkat_fokus: 3, catatan: "  agak ngantuk  " });
    expect(res.status).toBe(201);
    const badan = await res.json();

    expect(badan.success).toBe(true);
    expect(badan.checkin).toMatchObject({
      meal_log_id: meal.id,
      tingkat_energi: 4,
      tingkat_fokus: 3,
      catatan: "agak ngantuk",
    });
    expect(new Date(badan.checkin.waktu).toString()).not.toBe("Invalid Date");

    const baris = await prisma.checkin.findUniqueOrThrow({ where: { id: badan.checkin.id } });
    expect(baris).toMatchObject({ user_id: user.id, meal_log_id: meal.id, tingkat_energi: 4, tingkat_fokus: 3 });
  });

  it("catatan opsional: tanpa catatan tersimpan sebagai null", async () => {
    const { user, meal } = await penggunaDenganMeal();
    masukSebagai(user.id);

    const badan = await (await checkin({ meal_log_id: meal.id, tingkat_energi: 5, tingkat_fokus: 5 })).json();

    expect(badan.checkin.catatan).toBeNull();
  });

  it("check-in kedua untuk meal_log yang sama 409 CHECKIN_EXISTS dan baris pertama tidak berubah", async () => {
    const { user, meal } = await penggunaDenganMeal();
    masukSebagai(user.id);

    const pertama = await checkin({ meal_log_id: meal.id, tingkat_energi: 2, tingkat_fokus: 2 });
    expect(pertama.status).toBe(201);

    const kedua = await checkin({ meal_log_id: meal.id, tingkat_energi: 5, tingkat_fokus: 5 });
    expect(kedua.status).toBe(409);
    expect((await kedua.json()).error.code).toBe("CHECKIN_EXISTS");

    const semua = await prisma.checkin.findMany();
    expect(semua).toHaveLength(1);
    expect(semua[0]).toMatchObject({ tingkat_energi: 2, tingkat_fokus: 2 });
  });

  it("dua check-in bersamaan untuk meal_log yang sama: satu 201, satu 409", async () => {
    const { user, meal } = await penggunaDenganMeal();
    masukSebagai(user.id);

    const [a, b] = await Promise.all([
      checkin({ meal_log_id: meal.id, tingkat_energi: 3, tingkat_fokus: 3 }),
      checkin({ meal_log_id: meal.id, tingkat_energi: 4, tingkat_fokus: 4 }),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await prisma.checkin.count()).toBe(1);
  });

  it("asumsi tiruan terbukti: pelanggaran unik di Postgres sungguhan memberi galat Prisma berkode P2002", async () => {
    const { user, meal } = await penggunaDenganMeal();
    const data = { user_id: user.id, meal_log_id: meal.id, tingkat_energi: 3, tingkat_fokus: 3 };
    await prisma.checkin.create({ data });

    // Kode yang dibaca `kodeGalat()` di lib/services/meal-checkin.ts.
    await expect(prisma.checkin.create({ data })).rejects.toMatchObject({ code: "P2002" });
  });

  it("meal_log yang tidak ada: 404 NOT_FOUND", async () => {
    const user = await buatUser();
    masukSebagai(user.id);

    const res = await checkin({ meal_log_id: UUID_TIDAK_ADA, tingkat_energi: 3, tingkat_fokus: 3 });

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
    expect(await prisma.checkin.count()).toBe(0);
  });

  it("meal_log milik orang lain: 404 (sama dengan tidak ada) dan tidak ada baris tersimpan", async () => {
    const { meal } = await penggunaDenganMeal("Pemilik");
    const penyusup = await buatUser("Penyusup");
    masukSebagai(penyusup.id);

    const res = await checkin({ meal_log_id: meal.id, tingkat_energi: 1, tingkat_fokus: 1 });

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
    expect(await prisma.checkin.count()).toBe(0);
  });

  it("400 untuk skala di luar 1..5, uuid salah, dan body bukan JSON; 401 tanpa sesi", async () => {
    const { user, meal } = await penggunaDenganMeal();

    expect((await checkin({ meal_log_id: meal.id, tingkat_energi: 3, tingkat_fokus: 3 })).status).toBe(401);

    masukSebagai(user.id);
    for (const body of [
      { meal_log_id: meal.id, tingkat_energi: 0, tingkat_fokus: 3 },
      { meal_log_id: meal.id, tingkat_energi: 3, tingkat_fokus: 6 },
      { meal_log_id: meal.id, tingkat_energi: 2.5, tingkat_fokus: 3 },
      { meal_log_id: "bukan-uuid", tingkat_energi: 3, tingkat_fokus: 3 },
    ]) {
      const res = await checkin(body);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    }
    expect((await checkinPost(post("/api/checkins", "bukan json"))).status).toBe(400);
    expect(await prisma.checkin.count()).toBe(0);
  });

  it("GET /api/meals menandai sudah_checkin setelah check-in", async () => {
    const { user, meal } = await penggunaDenganMeal();
    masukSebagai(user.id);

    const sebelum = await (await mealsGet(get("/api/meals?tanggal=2026-11-21"))).json();
    expect(sebelum.meals[0]).toMatchObject({ id: meal.id, sudah_checkin: false });

    await checkin({ meal_log_id: meal.id, tingkat_energi: 4, tingkat_fokus: 4 });

    const sesudah = await (await mealsGet(get("/api/meals?tanggal=2026-11-21"))).json();
    expect(sesudah.meals[0]).toMatchObject({ id: meal.id, sudah_checkin: true });
  });
});
