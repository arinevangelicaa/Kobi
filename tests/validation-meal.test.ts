import { describe, expect, it } from "vitest";

import { mealCreateSchema, mealIdSchema } from "@/lib/validation/meal";

const UUID = "3f2b8c1e-9d4a-4e6b-8a1c-2d5f7e9b0a13";

describe("mealCreateSchema", () => {
  it("menerima input minimal dan mengisi waktu_makan dengan sekarang", () => {
    const sebelum = Date.now();
    const hasil = mealCreateSchema.parse({ teks_input: "nasi telur dan es teh" });

    expect(hasil.teks_input).toBe("nasi telur dan es teh");
    expect(hasil.waktu_makan).toBeInstanceOf(Date);
    expect(hasil.waktu_makan.getTime()).toBeGreaterThanOrEqual(sebelum);
    expect(hasil.vendor_id).toBeUndefined();
    expect(hasil.total_harga).toBeUndefined();
  });

  it("memangkas spasi di ujung teks", () => {
    const hasil = mealCreateSchema.parse({ teks_input: "  gudeg  " });
    expect(hasil.teks_input).toBe("gudeg");
  });

  it("menolak teks kosong atau hanya spasi", () => {
    expect(mealCreateSchema.safeParse({ teks_input: "" }).success).toBe(false);
    expect(mealCreateSchema.safeParse({ teks_input: "   " }).success).toBe(false);
  });

  it("menolak teks yang tidak ada atau bukan string", () => {
    expect(mealCreateSchema.safeParse({}).success).toBe(false);
    expect(mealCreateSchema.safeParse({ teks_input: 123 }).success).toBe(false);
  });

  it("menolak teks yang melebihi batas panjang", () => {
    const hasil = mealCreateSchema.safeParse({ teks_input: "a".repeat(501) });
    expect(hasil.success).toBe(false);
    if (!hasil.success) expect(hasil.error.issues[0]?.message).toContain("maksimal 500");
  });

  it("menerima waktu_makan ISO dengan offset dan mengubahnya jadi Date", () => {
    const hasil = mealCreateSchema.parse({
      teks_input: "soto",
      waktu_makan: "2026-11-21T12:30:00+07:00",
    });
    expect(hasil.waktu_makan.toISOString()).toBe("2026-11-21T05:30:00.000Z");
  });

  it("menolak waktu_makan yang bukan tanggal-waktu ISO", () => {
    expect(mealCreateSchema.safeParse({ teks_input: "soto", waktu_makan: "kemarin" }).success).toBe(
      false,
    );
  });

  it("menerima vendor_id uuid dan menolak yang bukan", () => {
    expect(mealCreateSchema.safeParse({ teks_input: "soto", vendor_id: UUID }).success).toBe(true);
    expect(mealCreateSchema.safeParse({ teks_input: "soto", vendor_id: "abc" }).success).toBe(false);
  });

  it("menerima total_harga bilangan bulat >= 0", () => {
    expect(mealCreateSchema.safeParse({ teks_input: "soto", total_harga: 0 }).success).toBe(true);
    expect(mealCreateSchema.safeParse({ teks_input: "soto", total_harga: 12000 }).success).toBe(true);
  });

  it("menolak total_harga negatif, desimal, atau bukan angka", () => {
    expect(mealCreateSchema.safeParse({ teks_input: "soto", total_harga: -1 }).success).toBe(false);
    expect(mealCreateSchema.safeParse({ teks_input: "soto", total_harga: 12.5 }).success).toBe(false);
    expect(mealCreateSchema.safeParse({ teks_input: "soto", total_harga: "12000" }).success).toBe(
      false,
    );
  });

  it("mengabaikan user_id dari body (selalu dari sesi)", () => {
    const hasil = mealCreateSchema.parse({ teks_input: "soto", user_id: UUID });
    expect(hasil).not.toHaveProperty("user_id");
  });
});

describe("mealIdSchema", () => {
  it("menerima uuid dan menolak string lain", () => {
    expect(mealIdSchema.safeParse(UUID).success).toBe(true);
    expect(mealIdSchema.safeParse("bukan-uuid").success).toBe(false);
  });
});
