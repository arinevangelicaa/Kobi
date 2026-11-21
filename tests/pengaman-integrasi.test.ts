import { describe, expect, it } from "vitest";

import { pastikanBasisDataUji } from "./integration/pengaman";

// Pengaman ini menjaga TRUNCATE di tes integrasi agar tidak pernah sampai ke
// basis data selain yang khusus untuk uji. Dites di suite unit (tanpa DB).

describe("pastikanBasisDataUji", () => {
  it.each([
    "postgresql://kobi:kobi_test@127.0.0.1:54329/kobi_test",
    "postgresql://kobi:kobi_test@localhost:5432/kobi_test?sslmode=disable",
    "postgresql://kobi:x@[::1]:5432/test",
    "postgresql://kobi:x@localhost/kobi-test?schema=public",
  ])("menerima %s", (url) => {
    expect(() => pastikanBasisDataUji(url)).not.toThrow();
  });

  it("menolak bila DATABASE_URL tidak ada atau bukan URL", () => {
    expect(() => pastikanBasisDataUji(undefined)).toThrow("belum diset");
    expect(() => pastikanBasisDataUji("bukan url")).toThrow("tidak dapat dibaca");
  });

  it.each([
    "postgresql://kobi:x@prod.example.com:5432/kobi_test",
    "postgresql://kobi:x@10.0.0.5/kobi_test",
    "postgresql://kobi:x@kobi-pg.postgres.database.azure.com/kobi_test",
  ])("menolak host non-lokal: %s", (url) => {
    expect(() => pastikanBasisDataUji(url)).toThrow(/menolak/);
  });

  it.each([
    "postgresql://kobi:x@localhost:5432/kobi",
    "postgresql://kobi:x@localhost:5432/kobi_latest",
    "postgresql://kobi:x@localhost:5432/contest",
    "postgresql://kobi:x@localhost:5432/testing",
    "postgresql://kobi:x@localhost:5432/",
  ])("menolak nama basis data yang bukan basis data uji: %s", (url) => {
    expect(() => pastikanBasisDataUji(url)).toThrow(/menolak/);
  });

  // pg-connection-string menyalin SEMUA parameter query ke konfigurasi koneksi,
  // jadi parameter ini menimpa host/database/user yang tampak aman di URL.
  it.each([
    "postgresql://kobi:kobi_test@localhost:5432/kobi_test?host=prod.example.com",
    "postgresql://kobi:kobi_test@localhost:5432/kobi_test?hostaddr=10.0.0.5",
    "postgresql://kobi:kobi_test@localhost:5432/kobi_test?db=produksi",
    "postgresql://kobi:kobi_test@localhost:5432/kobi_test?database=produksi",
    "postgresql://kobi:kobi_test@localhost:5432/kobi_test?HOST=prod.example.com",
    "postgresql://kobi:kobi_test@localhost:5432/kobi_test?sslmode=disable&host=prod.example.com",
  ])("menolak parameter query yang dapat menimpa tujuan: %s", (url) => {
    expect(() => pastikanBasisDataUji(url)).toThrow(/parameter query/);
  });
});
