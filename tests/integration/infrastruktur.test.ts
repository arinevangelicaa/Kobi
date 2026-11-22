import { describe, expect, it } from "vitest";

import { buatUser, kosongkanDb, pakaiDbBersih, prisma } from "./helpers";

pakaiDbBersih();

describe("infrastruktur tes integrasi", () => {
  it("terhubung ke Postgres uji dan migrasi sudah diterapkan", async () => {
    const tabel = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
    const nama = tabel.map((t) => t.tablename);

    for (const diharapkan of [
      "users",
      "class_schedules",
      "nutrition_targets",
      "meal_logs",
      "nutrition_estimates",
      "checkins",
      "vendors",
      "menu_items",
      "recommendations",
    ]) {
      expect(nama).toContain(diharapkan);
    }
  });

  it("kosongkanDb menghapus semua baris, termasuk data turunan", async () => {
    const user = await buatUser();
    await prisma.mealLog.create({
      data: { user_id: user.id, teks_input: "nasi", waktu_makan: new Date() },
    });

    await kosongkanDb();

    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.mealLog.count()).toBe(0);
  });

  it("tiap tes mulai dari DB kosong (tidak bergantung urutan)", async () => {
    expect(await prisma.user.count()).toBe(0);
  });

  it("proses berjalan di zona waktu uji yang disetel konfigurasi, bukan UTC", () => {
    // Memastikan tes TZ-sensitif benar-benar menguji sesuatu. Bila
    // INTEGRATION_TZ ditimpa jadi UTC, tes ini sengaja dilewati.
    if (process.env.INTEGRATION_TZ) return;
    expect(process.env.TZ).toBe("America/Los_Angeles");
    expect(new Date("2026-01-15T12:00:00Z").getTimezoneOffset()).toBe(480);
  });
});
