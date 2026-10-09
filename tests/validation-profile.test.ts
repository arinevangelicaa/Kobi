import { describe, expect, it } from "vitest";

import { profileUpdateSchema } from "@/lib/validation/profile";

describe("profileUpdateSchema", () => {
  it("menerima update data profil yang valid", () => {
    const input = {
      nama: "Arin Evangelica",
      tanggal_lahir: "2004-05-15",
      jenis_kelamin: "P",
      berat_badan_kg: 52.5,
      tinggi_badan_cm: 160,
      preferensi_anggaran: 25000,
    };

    const parsed = profileUpdateSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it("menerima update sebagian (parsial)", () => {
    const input = {
      preferensi_anggaran: 30000,
    };

    const parsed = profileUpdateSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it("menolak format tanggal lahir yang tidak valid", () => {
    const input = {
      tanggal_lahir: "15-05-2004", // Bukan YYYY-MM-DD
    };

    const parsed = profileUpdateSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it("menolak berat badan tidak realistis", () => {
    const input = {
      berat_badan_kg: 500,
    };

    const parsed = profileUpdateSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it("menolak field yang tidak diizinkan (strict)", () => {
    const input = {
      nama: "Test",
      role: "admin", // Unrecognized key
    };

    const parsed = profileUpdateSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });
});
