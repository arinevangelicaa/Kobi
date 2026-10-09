import { describe, expect, it } from "vitest";

import { dateKeJamStr, jamStrKeDate } from "@/lib/db-time";

describe("jamStrKeDate / dateKeJamStr", () => {
  it("round-trip dasar", () => {
    const d = jamStrKeDate("09:30");
    expect(dateKeJamStr(d)).toBe("09:30");
  });

  it("menangani jam satu digit dan tengah malam", () => {
    expect(dateKeJamStr(jamStrKeDate("0:5"))).toBe("00:05");
    expect(dateKeJamStr(jamStrKeDate("00:00"))).toBe("00:00");
    expect(dateKeJamStr(jamStrKeDate("23:59"))).toBe("23:59");
  });

  it("dateKeJamStr mengembalikan null untuk input kosong", () => {
    expect(dateKeJamStr(null)).toBeNull();
    expect(dateKeJamStr(undefined)).toBeNull();
  });

  it("hasil tidak bergantung TZ proses yang menjalankan kode (regresi #44)", () => {
    // Nilai literal yang ditulis ke Postgres (@db.Time(6)) untuk input yang
    // sama harus identik di TZ proses mana pun -- sebelum perbaikan #44,
    // implementasi lokal di app/api/schedules/route.ts menghasilkan literal
    // berbeda tergantung TZ server. jamStrKeDate menulis lewat UTC eksplisit
    // sehingga toISOString()-nya (representasi yang benar-benar dikirim ke
    // driver pg) tidak pernah berubah oleh TZ proses.
    const d = jamStrKeDate("09:00");
    expect(d.toISOString()).toBe("1970-01-01T09:00:00.000Z");
    expect(dateKeJamStr(d)).toBe("09:00");
  });
});
