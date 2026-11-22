import { describe, expect, it } from "vitest";

import { checkinCreateSchema } from "@/lib/validation/checkin";

const UUID = "3f2b8c1e-9d4a-4e6b-8a1c-2d5f7e9b0a13";
const valid = { meal_log_id: UUID, tingkat_energi: 4, tingkat_fokus: 3 };

describe("checkinCreateSchema", () => {
  it("menerima check-in valid tanpa catatan", () => {
    expect(checkinCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("menerima batas bawah 1 dan batas atas 5", () => {
    expect(
      checkinCreateSchema.safeParse({ ...valid, tingkat_energi: 1, tingkat_fokus: 5 }).success,
    ).toBe(true);
  });

  it("menolak tingkat di luar 1-5", () => {
    expect(checkinCreateSchema.safeParse({ ...valid, tingkat_energi: 0 }).success).toBe(false);
    expect(checkinCreateSchema.safeParse({ ...valid, tingkat_fokus: 6 }).success).toBe(false);
  });

  it("menolak tingkat desimal atau bukan angka", () => {
    expect(checkinCreateSchema.safeParse({ ...valid, tingkat_energi: 3.5 }).success).toBe(false);
    expect(checkinCreateSchema.safeParse({ ...valid, tingkat_fokus: "4" }).success).toBe(false);
  });

  it("menolak tingkat yang hilang", () => {
    expect(checkinCreateSchema.safeParse({ meal_log_id: UUID, tingkat_energi: 3 }).success).toBe(
      false,
    );
  });

  it("menolak meal_log_id yang bukan uuid", () => {
    const hasil = checkinCreateSchema.safeParse({ ...valid, meal_log_id: "123" });
    expect(hasil.success).toBe(false);
    if (!hasil.success) expect(hasil.error.issues[0]?.message).toContain("uuid");
  });

  it("memangkas catatan dan menerima null", () => {
    expect(checkinCreateSchema.parse({ ...valid, catatan: "  ngantuk  " }).catatan).toBe("ngantuk");
    expect(checkinCreateSchema.safeParse({ ...valid, catatan: null }).success).toBe(true);
  });

  it("menolak catatan yang terlalu panjang", () => {
    expect(checkinCreateSchema.safeParse({ ...valid, catatan: "a".repeat(501) }).success).toBe(
      false,
    );
  });
});
