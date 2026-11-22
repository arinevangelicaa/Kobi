import { describe, expect, it, vi } from "vitest";

import {
  MIN_CHECKIN_MINGGUAN,
  ambilCheckinMinggu,
  hitungTrenMingguan,
  keAgregatNarasi,
  rentangMingguWIB,
  type DataCheckin,
  type DbTren,
} from "@/lib/services/trend-insight";

const MINGGU = { mulai: "2026-11-16", selesai: "2026-11-22" };

function c(energi: number, fokus: number, protein: number | null): DataCheckin {
  return { tingkat_energi: energi, tingkat_fokus: fokus, protein_g: protein };
}

describe("rentangMingguWIB", () => {
  it("Rabu 2026-11-18 masuk minggu Senin 16 sampai Minggu 22 November", () => {
    const m = rentangMingguWIB("2026-11-18");

    expect(m.mulai).toBe("2026-11-16");
    expect(m.selesai).toBe("2026-11-22");
    expect(m.awal.toISOString()).toBe("2026-11-15T17:00:00.000Z");
    expect(m.akhir.toISOString()).toBe("2026-11-22T17:00:00.000Z");
  });

  it("Senin dan Minggu sama-sama jatuh di minggunya", () => {
    expect(rentangMingguWIB("2026-11-16").mulai).toBe("2026-11-16");
    expect(rentangMingguWIB("2026-11-22").mulai).toBe("2026-11-16");
    expect(rentangMingguWIB("2026-11-23").mulai).toBe("2026-11-23");
  });

  it("instant Minggu 23:30 WIB (16:30 UTC) masih minggu itu, Senin 00:30 WIB sudah minggu berikutnya", () => {
    expect(rentangMingguWIB(new Date("2026-11-22T16:30:00.000Z")).mulai).toBe("2026-11-16");
    expect(rentangMingguWIB(new Date("2026-11-22T17:30:00.000Z")).mulai).toBe("2026-11-23");
  });

  it("melewati batas bulan dan tahun", () => {
    const m = rentangMingguWIB("2027-01-01"); // Jumat

    expect(m.mulai).toBe("2026-12-28");
    expect(m.selesai).toBe("2027-01-03");
  });

  it("melempar RangeError untuk tanggal tidak valid", () => {
    expect(() => rentangMingguWIB("2026-02-30")).toThrow(RangeError);
  });
});

describe("hitungTrenMingguan", () => {
  it("keadaan kosong: tanpa check-in", () => {
    const tren = hitungTrenMingguan([], MINGGU);

    expect(tren.status).toBe("data_kurang");
    expect(tren.jumlah_checkin).toBe(0);
    expect(tren.rata_energi).toBeNull();
    expect(tren.rata_fokus).toBeNull();
    expect(tren.per_rentang_protein).toHaveLength(3);
    expect(tren.per_rentang_protein.every((r) => r.rata_energi === null && !r.cukup_data)).toBe(true);
  });

  it(`data kurang bila check-in kurang dari ${MIN_CHECKIN_MINGGUAN}`, () => {
    const tren = hitungTrenMingguan([c(4, 4, 25), c(3, 3, 12)], MINGGU);

    expect(tren.status).toBe("data_kurang");
    expect(tren.rata_energi).toBe(3.5); // tetap dihitung, UI memutuskan tampilan
  });

  it("menghitung rata-rata per rentang protein dengan batas bawah inklusif, atas eksklusif", () => {
    const data = [
      c(2, 2, 5), // rendah
      c(3, 3, 9.99), // rendah
      c(4, 3, 10), // sedang (10 inklusif)
      c(4, 4, 19.99), // sedang
      c(5, 5, 20), // tinggi (20 inklusif)
      c(4, 5, 45), // tinggi
    ];

    const tren = hitungTrenMingguan(data, MINGGU);
    const per = Object.fromEntries(tren.per_rentang_protein.map((r) => [r.kunci, r]));

    expect(tren.status).toBe("ok");
    expect(per.rendah).toMatchObject({ jumlah_checkin: 2, rata_energi: 2.5, rata_fokus: 2.5, cukup_data: true });
    expect(per.sedang).toMatchObject({ jumlah_checkin: 2, rata_energi: 4, rata_fokus: 3.5 });
    expect(per.tinggi).toMatchObject({ jumlah_checkin: 2, rata_energi: 4.5, rata_fokus: 5 });
    expect(tren.rata_energi).toBe(3.7); // 22/6 = 3.67
    expect(tren.rata_fokus).toBe(3.7); // 22/6
  });

  it("check-in tanpa estimasi ikut rata-rata mingguan tapi tidak masuk rentang mana pun", () => {
    const tren = hitungTrenMingguan([c(5, 5, null), c(1, 1, null), c(3, 3, 15)], MINGGU);

    expect(tren.jumlah_checkin).toBe(3);
    expect(tren.jumlah_dengan_estimasi).toBe(1);
    expect(tren.rata_energi).toBe(3);
    const total = tren.per_rentang_protein.reduce((a, r) => a + r.jumlah_checkin, 0);
    expect(total).toBe(1);
  });

  it("rentang dengan satu check-in tidak cukup_data untuk dibandingkan", () => {
    const tren = hitungTrenMingguan([c(3, 3, 5), c(3, 3, 5), c(5, 5, 30)], MINGGU);
    const tinggi = tren.per_rentang_protein.find((r) => r.kunci === "tinggi");

    expect(tinggi?.jumlah_checkin).toBe(1);
    expect(tinggi?.cukup_data).toBe(false);
  });
});

describe("keAgregatNarasi", () => {
  it("memetakan status ke cukup_data", () => {
    const ok = keAgregatNarasi(hitungTrenMingguan([c(3, 3, 5), c(3, 3, 5), c(3, 3, 5)], MINGGU));
    const kurang = keAgregatNarasi(hitungTrenMingguan([c(3, 3, 5)], MINGGU));

    expect(ok.cukup_data).toBe(true);
    expect(ok.minggu_mulai).toBe("2026-11-16");
    expect(kurang.cukup_data).toBe(false);
  });
});

describe("ambilCheckinMinggu", () => {
  function buatDb(baris: unknown[]) {
    const findMany = vi.fn().mockResolvedValue(baris);
    return { db: { checkin: { findMany } } as unknown as DbTren, findMany };
  }

  it("memetakan baris DB, protein Decimal jadi number dan tanpa estimasi jadi null", async () => {
    const { db } = buatDb([
      { tingkat_energi: 4, tingkat_fokus: 3, meal_log: { nutrition_estimate: { protein_g: "18.50" } } },
      { tingkat_energi: 2, tingkat_fokus: 2, meal_log: { nutrition_estimate: null } },
    ]);

    const hasil = await ambilCheckinMinggu(db, "u1", rentangMingguWIB("2026-11-18"));

    expect(hasil).toEqual([
      { tingkat_energi: 4, tingkat_fokus: 3, protein_g: 18.5 },
      { tingkat_energi: 2, tingkat_fokus: 2, protein_g: null },
    ]);
  });

  it("query hanya milik pengguna itu dan memakai batas minggu WIB", async () => {
    const { db, findMany } = buatDb([]);

    await ambilCheckinMinggu(db, "u1", rentangMingguWIB("2026-11-18"));

    const where = findMany.mock.calls[0]?.[0].where;
    expect(where.user_id).toBe("u1");
    expect(where.meal_log.user_id).toBe("u1");
    expect(where.meal_log.waktu_makan.gte.toISOString()).toBe("2026-11-15T17:00:00.000Z");
    expect(where.meal_log.waktu_makan.lt.toISOString()).toBe("2026-11-22T17:00:00.000Z");
  });
});
