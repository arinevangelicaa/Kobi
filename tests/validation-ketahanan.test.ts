import { describe, expect, it } from "vitest";

import { registerSchema } from "@/lib/validation/auth";
import { checkinCreateSchema } from "@/lib/validation/checkin";
import { mealCreateSchema } from "@/lib/validation/meal";
import { profileUpdateSchema } from "@/lib/validation/profile";
import { scheduleCreateSchema } from "@/lib/validation/schedule";
import { PESAN_NUL, tanpaNul } from "@/lib/validation/umum";

// Regresi dari temuan tes integrasi (#52): input yang lolos Zod lalu ditolak
// Postgres atau bergeser diam-diam, sehingga klien menerima 500 atau data salah.

describe("tanpaNul", () => {
  it("menolak NUL dan menerima teks biasa", () => {
    expect(tanpaNul("nasi\u0000goreng")).toBe(false);
    expect(tanpaNul("nasi goreng")).toBe(true);
    expect(tanpaNul("")).toBe(true);
  });
});

describe("profileUpdateSchema: tanggal_lahir kalender-valid", () => {
  it.each(["2003-02-31", "2003-13-01", "2003-00-10", "2003-04-31", "2003-02-29"])(
    "menolak %s",
    (tanggal) => {
      const hasil = profileUpdateSchema.safeParse({ tanggal_lahir: tanggal });
      expect(hasil.success).toBe(false);
      if (!hasil.success) expect(hasil.error.issues[0]?.message).toBe("Tanggal lahir tidak valid.");
    },
  );

  it.each(["2003-02-28", "2004-02-29", "2003-12-31"])("menerima %s", (tanggal) => {
    expect(profileUpdateSchema.safeParse({ tanggal_lahir: tanggal }).success).toBe(true);
  });

  it("null (menghapus tanggal lahir) tetap diterima", () => {
    expect(profileUpdateSchema.safeParse({ tanggal_lahir: null }).success).toBe(true);
  });

  it("format selain YYYY-MM-DD tetap ditolak oleh regex", () => {
    expect(profileUpdateSchema.safeParse({ tanggal_lahir: "31-12-2003" }).success).toBe(false);
  });
});

describe("profileUpdateSchema: preferensi_anggaran dan teks", () => {
  it("menolak anggaran di atas batas dan di luar rentang INT4", () => {
    const hasil = profileUpdateSchema.safeParse({ preferensi_anggaran: 3_000_000_000 });
    expect(hasil.success).toBe(false);
    if (!hasil.success) expect(hasil.error.issues[0]?.message).toBe("Anggaran terlalu besar.");
    expect(profileUpdateSchema.safeParse({ preferensi_anggaran: 100_000_001 }).success).toBe(false);
  });

  it("menerima anggaran tepat di batas", () => {
    expect(profileUpdateSchema.safeParse({ preferensi_anggaran: 100_000_000 }).success).toBe(true);
  });

  it("menolak NUL pada nama", () => {
    const hasil = profileUpdateSchema.safeParse({ nama: "Ad\u0000nan" });
    expect(hasil.success).toBe(false);
    if (!hasil.success) expect(hasil.error.issues[0]?.message).toBe(PESAN_NUL);
  });
});

describe("karakter NUL ditolak di semua teks bebas yang disimpan", () => {
  it("teks_input catat makan", () => {
    const hasil = mealCreateSchema.safeParse({ teks_input: "nasi\u0000goreng" });
    expect(hasil.success).toBe(false);
    if (!hasil.success) expect(hasil.error.issues[0]?.message).toBe(PESAN_NUL);
  });

  it("nama pada register", () => {
    const hasil = registerSchema.safeParse({
      email: "a@b.id",
      password: "panjangnya-cukup",
      nama: "Ad\u0000nan",
    });
    expect(hasil.success).toBe(false);
    if (!hasil.success) expect(hasil.error.issues[0]?.message).toBe(PESAN_NUL);
  });

  it("catatan check-in", () => {
    const hasil = checkinCreateSchema.safeParse({
      meal_log_id: "11111111-1111-4111-8111-111111111111",
      tingkat_energi: 3,
      tingkat_fokus: 3,
      catatan: "capek\u0000sekali",
    });
    expect(hasil.success).toBe(false);
  });

  it("mata kuliah dan lokasi ruang jadwal", () => {
    const dasar = { hari: 1, jam_mulai: "08:00", jam_selesai: "09:40" };
    expect(scheduleCreateSchema.safeParse({ ...dasar, mata_kuliah: "Kalkulus\u0000" }).success).toBe(false);
    expect(
      scheduleCreateSchema.safeParse({ ...dasar, mata_kuliah: "Kalkulus", lokasi_ruang: "R\u0000101" }).success,
    ).toBe(false);
    expect(
      scheduleCreateSchema.safeParse({ ...dasar, mata_kuliah: "Kalkulus", lokasi_ruang: "R101" }).success,
    ).toBe(true);
  });

  it("teks biasa (termasuk emoji dan baris baru) tetap diterima", () => {
    expect(mealCreateSchema.safeParse({ teks_input: "nasi goreng 🍳\ntelur" }).success).toBe(true);
  });
});
