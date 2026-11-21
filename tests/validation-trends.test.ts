import { describe, expect, it } from "vitest";

import { trendsWeeklyQuerySchema } from "@/lib/validation/trends";

describe("trendsWeeklyQuerySchema", () => {
  it("minggu opsional", () => {
    const hasil = trendsWeeklyQuerySchema.safeParse({});
    expect(hasil.success).toBe(true);
    expect(hasil.data?.minggu).toBeUndefined();
  });

  it("string kosong dan null dianggap tidak diisi", () => {
    expect(trendsWeeklyQuerySchema.parse({ minggu: "" }).minggu).toBeUndefined();
    expect(trendsWeeklyQuerySchema.parse({ minggu: null }).minggu).toBeUndefined();
  });

  it("menerima tanggal YYYY-MM-DD yang valid", () => {
    expect(trendsWeeklyQuerySchema.parse({ minggu: "2026-11-18" }).minggu).toBe("2026-11-18");
  });

  it("menolak format salah", () => {
    for (const buruk of ["18-11-2026", "2026/11/18", "2026-11-18T00:00:00Z", "kemarin", "2026-1-5"]) {
      const hasil = trendsWeeklyQuerySchema.safeParse({ minggu: buruk });
      expect(hasil.success, buruk).toBe(false);
    }
  });

  it("menolak tanggal yang tidak ada di kalender", () => {
    const hasil = trendsWeeklyQuerySchema.safeParse({ minggu: "2026-02-30" });
    expect(hasil.success).toBe(false);
    expect(hasil.error?.issues[0]?.message).toMatch(/bukan tanggal/);
  });
});
