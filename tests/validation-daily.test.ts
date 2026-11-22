import { describe, expect, it } from "vitest";

import { rentangHariWIB } from "@/lib/time-wib";
import { dailyQuerySchema } from "@/lib/validation/daily";

describe("dailyQuerySchema", () => {
  it("menerima tanggal YYYY-MM-DD yang valid", () => {
    expect(dailyQuerySchema.parse({ tanggal: "2026-11-21" }).tanggal).toBe("2026-11-21");
  });

  it("tanpa tanggal: default hari ini menurut WIB", () => {
    const hasil = dailyQuerySchema.parse({});
    expect(hasil.tanggal).toBe(rentangHariWIB().tanggal);
  });

  it("menolak format selain YYYY-MM-DD", () => {
    expect(dailyQuerySchema.safeParse({ tanggal: "21-11-2026" }).success).toBe(false);
    expect(dailyQuerySchema.safeParse({ tanggal: "2026/11/21" }).success).toBe(false);
    expect(dailyQuerySchema.safeParse({ tanggal: "" }).success).toBe(false);
  });

  it("menolak tanggal yang tidak ada di kalender", () => {
    const hasil = dailyQuerySchema.safeParse({ tanggal: "2026-02-31" });
    expect(hasil.success).toBe(false);
    if (!hasil.success) expect(hasil.error.issues[0]?.message).toBe("Tanggal tidak valid.");
  });
});
