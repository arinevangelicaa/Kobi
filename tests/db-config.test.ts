import { describe, expect, it } from "vitest";

import { bacaKonfigurasiPool, POOL_MAX_BATAS, POOL_MAX_DEFAULT } from "@/lib/db";

const URL_DB = "postgresql://u:p@host:5432/kobi";

describe("bacaKonfigurasiPool", () => {
  it("melempar galat bila DATABASE_URL belum diset", () => {
    expect(() => bacaKonfigurasiPool({})).toThrow("DATABASE_URL belum diset");
    expect(() => bacaKonfigurasiPool({ DATABASE_URL: "" })).toThrow("DATABASE_URL belum diset");
  });

  it("memakai default pool kecil bila DATABASE_POOL_MAX kosong", () => {
    const k = bacaKonfigurasiPool({ DATABASE_URL: URL_DB });
    expect(k.max).toBe(POOL_MAX_DEFAULT);
    expect(k.peringatan).toEqual([]);
  });

  it.each(["51", "100000", "1e21"])(
    "memotong DATABASE_POOL_MAX=%s ke batas atas dan memberi peringatan",
    (nilai) => {
      const k = bacaKonfigurasiPool({ DATABASE_URL: URL_DB, DATABASE_POOL_MAX: nilai });
      expect(k.max).toBe(POOL_MAX_BATAS);
      expect(k.peringatan.join(" ")).toContain("melebihi batas");
    },
  );

  it("menerima tepat di batas atas tanpa peringatan", () => {
    const k = bacaKonfigurasiPool({ DATABASE_URL: URL_DB, DATABASE_POOL_MAX: String(POOL_MAX_BATAS) });
    expect(k.max).toBe(POOL_MAX_BATAS);
    expect(k.peringatan).toEqual([]);
  });

  it("memperingatkan di produksi untuk sslmode=no-verify (sertifikat tidak diverifikasi)", () => {
    const k = bacaKonfigurasiPool({
      DATABASE_URL: `${URL_DB}?sslmode=no-verify`,
      NODE_ENV: "production",
    });
    expect(k.peringatan.join(" ")).toContain("no-verify");
  });

  it("membaca DATABASE_POOL_MAX yang valid", () => {
    expect(bacaKonfigurasiPool({ DATABASE_URL: URL_DB, DATABASE_POOL_MAX: "10" }).max).toBe(10);
    expect(bacaKonfigurasiPool({ DATABASE_URL: URL_DB, DATABASE_POOL_MAX: " 3 " }).max).toBe(3);
  });

  it.each(["0", "-2", "abc", "2.5", "1e3x"])(
    "kembali ke default dan memberi peringatan untuk DATABASE_POOL_MAX=%s",
    (nilai) => {
      const k = bacaKonfigurasiPool({ DATABASE_URL: URL_DB, DATABASE_POOL_MAX: nilai });
      expect(k.max).toBe(POOL_MAX_DEFAULT);
      expect(k.peringatan.join(" ")).toContain("DATABASE_POOL_MAX");
    },
  );

  it("membaca sslmode dari DATABASE_URL", () => {
    expect(bacaKonfigurasiPool({ DATABASE_URL: `${URL_DB}?sslmode=require` }).sslmode).toBe(
      "require",
    );
    expect(bacaKonfigurasiPool({ DATABASE_URL: URL_DB }).sslmode).toBeNull();
  });

  it("memperingatkan di produksi bila SSL tidak aktif", () => {
    const tanpa = bacaKonfigurasiPool({ DATABASE_URL: URL_DB, NODE_ENV: "production" });
    expect(tanpa.peringatan.join(" ")).toContain("sslmode");

    const mati = bacaKonfigurasiPool({
      DATABASE_URL: `${URL_DB}?sslmode=disable`,
      NODE_ENV: "production",
    });
    expect(mati.peringatan.join(" ")).toContain("sslmode");
  });

  it("tidak memperingatkan SSL di produksi bila sslmode=require", () => {
    const k = bacaKonfigurasiPool({
      DATABASE_URL: `${URL_DB}?sslmode=require`,
      NODE_ENV: "production",
    });
    expect(k.peringatan).toEqual([]);
  });

  it("tidak memperingatkan SSL di luar produksi", () => {
    const k = bacaKonfigurasiPool({ DATABASE_URL: URL_DB, NODE_ENV: "development" });
    expect(k.peringatan).toEqual([]);
  });

  it("tidak memuat pengaturan yang menonaktifkan verifikasi sertifikat", () => {
    const k = bacaKonfigurasiPool({ DATABASE_URL: `${URL_DB}?sslmode=require` });
    expect(JSON.stringify(k)).not.toContain("rejectUnauthorized");
  });
});
