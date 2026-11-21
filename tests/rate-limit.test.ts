import { beforeEach, describe, expect, it, vi } from "vitest";

// `lib/api` mengimpor Auth.js; tes ini tidak butuh sesi.
vi.mock("@/lib/auth", () => ({ auth: async () => null }));

import {
  BATAS,
  INTERVAL_SAPU_MS,
  MAKS_KUNCI,
  ambilKunciEstimasi,
  batasiLaju,
  jumlahKunciTersimpan,
  periksaBatas,
  resetPembatasLaju,
} from "@/lib/rate-limit";

const KONFIG = { maks: 3, jendelaMs: 10_000 };
const T0 = 1_000_000;

beforeEach(() => {
  resetPembatasLaju();
});

describe("periksaBatas", () => {
  it("meloloskan permintaan di bawah batas", () => {
    for (let i = 0; i < 3; i++) {
      expect(periksaBatas("b", "u1", KONFIG, T0 + i)).toEqual({ diizinkan: true });
    }
  });

  it("menolak permintaan yang melewati batas dengan ulangiDalamDetik yang benar", () => {
    periksaBatas("b", "u1", KONFIG, T0);
    periksaBatas("b", "u1", KONFIG, T0 + 1_000);
    periksaBatas("b", "u1", KONFIG, T0 + 2_000);

    // Permintaan tertua (T0) keluar dari jendela pada T0 + 10_000.
    const hasil = periksaBatas("b", "u1", KONFIG, T0 + 4_000);
    expect(hasil).toEqual({ diizinkan: false, ulangiDalamDetik: 6 });
  });

  it("membulatkan ke atas dan tidak pernah kurang dari 1 detik", () => {
    for (let i = 0; i < 3; i++) periksaBatas("b", "u1", KONFIG, T0);

    expect(periksaBatas("b", "u1", KONFIG, T0 + 9_500)).toEqual({
      diizinkan: false,
      ulangiDalamDetik: 1,
    });
    expect(periksaBatas("b", "u1", KONFIG, T0 + 1)).toEqual({
      diizinkan: false,
      ulangiDalamDetik: 10,
    });
  });

  it("jendela bergeser: slot bebas satu per satu saat permintaan lama keluar", () => {
    periksaBatas("b", "u1", KONFIG, T0);
    periksaBatas("b", "u1", KONFIG, T0 + 5_000);
    periksaBatas("b", "u1", KONFIG, T0 + 6_000);
    expect(periksaBatas("b", "u1", KONFIG, T0 + 9_000).diizinkan).toBe(false);

    // Tepat setelah T0 keluar dari jendela, satu slot terbuka.
    expect(periksaBatas("b", "u1", KONFIG, T0 + 10_000).diizinkan).toBe(true);
    // Slot lain belum terbuka (T0+5_000 masih di dalam jendela).
    expect(periksaBatas("b", "u1", KONFIG, T0 + 10_001)).toEqual({
      diizinkan: false,
      ulangiDalamDetik: 5,
    });
    // Jendela yang sudah lewat seluruhnya membebaskan semua slot.
    for (let i = 0; i < 3; i++) {
      expect(periksaBatas("b", "u1", KONFIG, T0 + 30_000).diizinkan).toBe(true);
    }
  });

  it("permintaan yang ditolak tidak memperpanjang masa tunggu", () => {
    for (let i = 0; i < 3; i++) periksaBatas("b", "u1", KONFIG, T0);
    for (let i = 1; i <= 20; i++) periksaBatas("b", "u1", KONFIG, T0 + i * 100);

    expect(periksaBatas("b", "u1", KONFIG, T0 + 10_000).diizinkan).toBe(true);
  });

  it("pengguna berbeda tidak saling memengaruhi", () => {
    for (let i = 0; i < 3; i++) periksaBatas("b", "u1", KONFIG, T0);
    expect(periksaBatas("b", "u1", KONFIG, T0).diizinkan).toBe(false);
    expect(periksaBatas("b", "u2", KONFIG, T0).diizinkan).toBe(true);
  });

  it("bucket berbeda terpisah untuk pengguna yang sama", () => {
    for (let i = 0; i < 3; i++) periksaBatas("a", "u1", KONFIG, T0);
    expect(periksaBatas("a", "u1", KONFIG, T0).diizinkan).toBe(false);
    expect(periksaBatas("b", "u1", KONFIG, T0).diizinkan).toBe(true);
  });

  it("user_id dan bucket yang digabung tidak bertabrakan", () => {
    for (let i = 0; i < 3; i++) periksaBatas("a", "bu1", KONFIG, T0);
    expect(periksaBatas("ab", "u1", KONFIG, T0).diizinkan).toBe(true);
  });
});

describe("pembersihan entri lama", () => {
  it("menyapu kunci yang jendelanya sudah lewat setelah interval sapu", () => {
    for (let i = 0; i < 50; i++) periksaBatas("b", `u${i}`, KONFIG, T0);
    expect(jumlahKunciTersimpan()).toBe(50);

    // Permintaan jauh setelahnya memicu sapuan; hanya kunci baru yang tersisa.
    periksaBatas("b", "baru", KONFIG, T0 + INTERVAL_SAPU_MS + KONFIG.jendelaMs);
    expect(jumlahKunciTersimpan()).toBe(1);
  });

  it("tidak menyapu kunci yang jendelanya masih berlaku", () => {
    const panjang = { maks: 3, jendelaMs: 10 * INTERVAL_SAPU_MS };
    periksaBatas("b", "u1", panjang, T0);
    periksaBatas("b", "u2", KONFIG, T0 + INTERVAL_SAPU_MS);
    expect(jumlahKunciTersimpan()).toBe(2);
  });

  it("membatasi jumlah kunci supaya Map tidak membengkak tanpa batas", () => {
    const panjang = { maks: 3, jendelaMs: 10 * INTERVAL_SAPU_MS };
    for (let i = 0; i < MAKS_KUNCI + 500; i++) periksaBatas("b", `u${i}`, panjang, T0);

    // Kelebihan dibuang saat permintaan berikutnya, jadi
    // jumlahnya tidak pernah jauh melampaui MAKS_KUNCI.
    expect(jumlahKunciTersimpan()).toBeLessThanOrEqual(MAKS_KUNCI + 1);
  });
});

describe("batasiLaju", () => {
  it("lolos (null) di bawah batas, lalu 429 dengan Retry-After dan kode RATE_LIMITED", async () => {
    const { maks } = BATAS.trenMingguan;
    for (let i = 0; i < maks; i++) expect(batasiLaju("trenMingguan", "u1")).toBeNull();

    const res = batasiLaju("trenMingguan", "u1");
    expect(res).not.toBeNull();
    expect(res?.status).toBe(429);
    const detik = Number(res?.headers.get("Retry-After"));
    expect(detik).toBeGreaterThanOrEqual(1);
    expect(detik).toBeLessThanOrEqual(BATAS.trenMingguan.jendelaMs / 1000);
    const json = await res?.json();
    expect(json.error.code).toBe("RATE_LIMITED");
    expect(json.error.message).toContain(String(detik));
  });

  it("resetPembatasLaju mengosongkan keadaan", () => {
    const { maks } = BATAS.estimasiUlang;
    for (let i = 0; i < maks; i++) batasiLaju("estimasiUlang", "u1");
    expect(batasiLaju("estimasiUlang", "u1")).not.toBeNull();

    resetPembatasLaju();
    expect(batasiLaju("estimasiUlang", "u1")).toBeNull();
  });
});

describe("ambilKunciEstimasi", () => {
  it("menolak pengambilan kedua untuk catatan yang sama selama masih dipegang", () => {
    const lepas = ambilKunciEstimasi("u1", "m1");
    expect(lepas).toBeTypeOf("function");
    expect(ambilKunciEstimasi("u1", "m1")).toBeNull();

    lepas?.();
    expect(ambilKunciEstimasi("u1", "m1")).not.toBeNull();
  });

  it("catatan atau pengguna berbeda tidak saling memblokir", () => {
    expect(ambilKunciEstimasi("u1", "m1")).not.toBeNull();
    expect(ambilKunciEstimasi("u1", "m2")).not.toBeNull();
    expect(ambilKunciEstimasi("u2", "m1")).not.toBeNull();
  });

  it("pelepas idempoten: panggilan lama tidak melepas kunci pemegang baru", () => {
    const lepasA = ambilKunciEstimasi("u1", "m1");
    lepasA?.();
    const lepasB = ambilKunciEstimasi("u1", "m1");
    expect(lepasB).not.toBeNull();

    lepasA?.();
    expect(ambilKunciEstimasi("u1", "m1")).toBeNull();
  });
});
