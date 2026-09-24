import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/password";

describe("hashPassword / verifyPassword", () => {
  it("hash bisa diverifikasi dengan password yang sama", async () => {
    const hash = await hashPassword("kataSandiAman123");
    expect(await verifyPassword(hash, "kataSandiAman123")).toBe(true);
  });

  it("menolak password yang salah", async () => {
    const hash = await hashPassword("kataSandiAman123");
    expect(await verifyPassword(hash, "salah")).toBe(false);
  });

  it("hash memakai format argon2id ($argon2id$)", async () => {
    const hash = await hashPassword("kataSandiAman123");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("dua hash dari password sama tetap berbeda (salt acak)", async () => {
    const [a, b] = await Promise.all([
      hashPassword("kataSandiAman123"),
      hashPassword("kataSandiAman123"),
    ]);
    expect(a).not.toBe(b);
  });
});
