import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "@/lib/validation/auth";

describe("registerSchema", () => {
  it("menerima input valid dan menormalkan email jadi huruf kecil", () => {
    const hasil = registerSchema.parse({
      email: "Mahasiswa@Mail.UGM.AC.ID",
      password: "kataSandiAman123",
      nama: "Mahasiswa Kobi",
    });
    expect(hasil.email).toBe("mahasiswa@mail.ugm.ac.id");
  });

  it("menolak email tidak valid", () => {
    const hasil = registerSchema.safeParse({
      email: "bukan-email",
      password: "kataSandiAman123",
      nama: "Mahasiswa",
    });
    expect(hasil.success).toBe(false);
  });

  it("menolak password di bawah 8 karakter", () => {
    const hasil = registerSchema.safeParse({
      email: "a@b.com",
      password: "pendek",
      nama: "Mahasiswa",
    });
    expect(hasil.success).toBe(false);
  });

  it("menolak nama kosong setelah trim", () => {
    const hasil = registerSchema.safeParse({
      email: "a@b.com",
      password: "kataSandiAman123",
      nama: "   ",
    });
    expect(hasil.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("menerima kredensial minimal", () => {
    const hasil = loginSchema.safeParse({ email: "a@b.com", password: "x" });
    expect(hasil.success).toBe(true);
  });

  it("menolak password kosong", () => {
    const hasil = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(hasil.success).toBe(false);
  });
});
