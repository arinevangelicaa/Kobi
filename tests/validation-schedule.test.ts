import { describe, expect, it } from "vitest";

import { scheduleCreateSchema } from "@/lib/validation/schedule";

describe("scheduleCreateSchema", () => {
  it("menerima jadwal kuliah yang valid", () => {
    const input = {
      mata_kuliah: "Senior Project TI",
      hari: 1, // Senin
      jam_mulai: "07:30",
      jam_selesai: "10:00",
      lokasi_ruang: "E6",
    };

    const parsed = scheduleCreateSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it("menolak jika jam mulai lebih lambat dari jam selesai", () => {
    const input = {
      mata_kuliah: "Jaringan Komputer",
      hari: 2,
      jam_mulai: "13:00",
      jam_selesai: "11:00",
    };

    const parsed = scheduleCreateSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it("menolak nilai hari di luar rentang 1-7", () => {
    const input = {
      mata_kuliah: "Kecerdasan Buatan",
      hari: 8,
      jam_mulai: "08:00",
      jam_selesai: "10:00",
    };

    const parsed = scheduleCreateSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it("menolak format jam yang salah", () => {
    const input = {
      mata_kuliah: "Sistem Basis Data",
      hari: 3,
      jam_mulai: "8 pagi",
      jam_selesai: "10:00",
    };

    const parsed = scheduleCreateSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });
});
