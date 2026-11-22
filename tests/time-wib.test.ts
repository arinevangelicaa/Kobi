import { describe, expect, it } from "vitest";

import { rentangHariWIB } from "@/lib/time-wib";

describe("rentangHariWIB", () => {
  it("memetakan string tanggal ke tengah malam WIB (17:00 UTC hari sebelumnya)", () => {
    const r = rentangHariWIB("2026-11-21");
    expect(r.tanggal).toBe("2026-11-21");
    expect(r.awal.toISOString()).toBe("2026-11-20T17:00:00.000Z");
    expect(r.akhir.toISOString()).toBe("2026-11-21T17:00:00.000Z");
  });

  it("jam 00:00-06:59 WIB masuk hari WIB yang benar, bukan hari UTC (regresi gaya #39/#44)", () => {
    // 03:00 WIB tanggal 22 = 20:00 UTC tanggal 21. Hari kalender UTC-nya 21,
    // hari kalender WIB-nya 22.
    const r = rentangHariWIB(new Date("2026-11-21T20:00:00.000Z"));
    expect(r.tanggal).toBe("2026-11-22");
    expect(r.awal.toISOString()).toBe("2026-11-21T17:00:00.000Z");
    expect(r.akhir.toISOString()).toBe("2026-11-22T17:00:00.000Z");
  });

  it("detik terakhir sebelum tengah malam WIB masih hari yang sama", () => {
    const r = rentangHariWIB(new Date("2026-11-21T16:59:59.999Z"));
    expect(r.tanggal).toBe("2026-11-21");
  });

  it("tepat tengah malam WIB sudah hari berikutnya (awal inklusif)", () => {
    const r = rentangHariWIB(new Date("2026-11-21T17:00:00.000Z"));
    expect(r.tanggal).toBe("2026-11-22");
    expect(r.awal.toISOString()).toBe("2026-11-21T17:00:00.000Z");
  });

  it("melewati pergantian tahun", () => {
    const r = rentangHariWIB(new Date("2025-12-31T18:00:00.000Z"));
    expect(r.tanggal).toBe("2026-01-01");
  });

  it("lebar rentang selalu 24 jam", () => {
    const r = rentangHariWIB("2026-02-28");
    expect(r.akhir.getTime() - r.awal.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("tanggal 29 Februari hanya valid di tahun kabisat", () => {
    expect(rentangHariWIB("2028-02-29").tanggal).toBe("2028-02-29");
    expect(() => rentangHariWIB("2026-02-29")).toThrow(RangeError);
  });

  it("menolak format dan tanggal yang tidak valid", () => {
    expect(() => rentangHariWIB("21-11-2026")).toThrow(RangeError);
    expect(() => rentangHariWIB("2026-13-01")).toThrow(RangeError);
    expect(() => rentangHariWIB("2026-11-31")).toThrow(RangeError);
    expect(() => rentangHariWIB("abc")).toThrow(RangeError);
    expect(() => rentangHariWIB(new Date("tidak valid"))).toThrow(RangeError);
  });

  it("tanpa argumen memakai waktu sekarang", () => {
    const sebelum = Date.now();
    const r = rentangHariWIB();
    expect(r.awal.getTime()).toBeLessThanOrEqual(sebelum);
    expect(r.akhir.getTime()).toBeGreaterThan(sebelum);
  });
});
