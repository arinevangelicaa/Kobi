import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { _resetCacheUntukTest, hitungJarakWaktuBanyakTujuan } from "@/lib/azure/maps";

const lokasiUGM = { latitude: -7.7667, longitude: 110.3774 };

function buatResponMatrix(selResult: Array<{ statusCode: number; lengthInMeters?: number; travelTimeInSeconds?: number }>) {
  return {
    matrix: [
      selResult.map((s) => ({
        statusCode: s.statusCode,
        response:
          s.statusCode === 200
            ? { routeSummary: { lengthInMeters: s.lengthInMeters, travelTimeInSeconds: s.travelTimeInSeconds } }
            : undefined,
      })),
    ],
  };
}

describe("hitungJarakWaktuBanyakTujuan", () => {
  const originalEnv = process.env.AZURE_MAPS_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    _resetCacheUntukTest();
  });

  afterEach(() => {
    process.env.AZURE_MAPS_KEY = originalEnv;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("mengembalikan Map kosong tanpa memanggil fetch bila kunci belum diset", async () => {
    delete process.env.AZURE_MAPS_KEY;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const hasil = await hitungJarakWaktuBanyakTujuan(lokasiUGM, [
      { id: "v1", latitude: -7.76, longitude: 110.37 },
    ]);

    expect(hasil.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mengembalikan Map kosong (bukan throw) saat fetch gagal total", async () => {
    process.env.AZURE_MAPS_KEY = "kunci-uji";
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("jaringan putus")) as unknown as typeof fetch;

    const hasil = await hitungJarakWaktuBanyakTujuan(lokasiUGM, [
      { id: "v1", latitude: -7.76, longitude: 110.37 },
    ]);

    expect(hasil.size).toBe(0);
  });

  it("mengembalikan Map kosong (bukan throw) saat Azure Maps balas status bukan 200", async () => {
    process.env.AZURE_MAPS_KEY = "kunci-uji";
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;

    const hasil = await hitungJarakWaktuBanyakTujuan(lokasiUGM, [
      { id: "v1", latitude: -7.76, longitude: 110.37 },
    ]);

    expect(hasil.size).toBe(0);
  });

  it("mem-parsing hasil sukses dan membulatkan meter + menit", async () => {
    process.env.AZURE_MAPS_KEY = "kunci-uji";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        buatResponMatrix([{ statusCode: 200, lengthInMeters: 521.7, travelTimeInSeconds: 185 }]),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const hasil = await hitungJarakWaktuBanyakTujuan(lokasiUGM, [
      { id: "v1", latitude: -7.76, longitude: 110.37 },
    ]);

    expect(hasil.get("v1")).toEqual({ jarakMeter: 522, waktuTempuhMenit: 4 }); // ceil(185/60) = 4
  });

  it("melewatkan vendor dengan statusCode gagal di dalam matrix, bukan membatalkan semuanya", async () => {
    process.env.AZURE_MAPS_KEY = "kunci-uji";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        buatResponMatrix([
          { statusCode: 200, lengthInMeters: 500, travelTimeInSeconds: 120 },
          { statusCode: 400 },
        ]),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const hasil = await hitungJarakWaktuBanyakTujuan(lokasiUGM, [
      { id: "v1", latitude: -7.76, longitude: 110.37 },
      { id: "v2", latitude: -7.77, longitude: 110.38 },
    ]);

    expect(hasil.has("v1")).toBe(true);
    expect(hasil.has("v2")).toBe(false);
  });

  it("tidak memanggil fetch lagi untuk pasangan yang sudah ada di cache", async () => {
    process.env.AZURE_MAPS_KEY = "kunci-uji";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        buatResponMatrix([{ statusCode: 200, lengthInMeters: 500, travelTimeInSeconds: 120 }]),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const tujuan = [{ id: "v1", latitude: -7.76, longitude: 110.37 }];

    await hitungJarakWaktuBanyakTujuan(lokasiUGM, tujuan);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const hasilKedua = await hitungJarakWaktuBanyakTujuan(lokasiUGM, tujuan);
    expect(fetchMock).toHaveBeenCalledTimes(1); // tidak nambah, dari cache
    expect(hasilKedua.get("v1")).toEqual({ jarakMeter: 500, waktuTempuhMenit: 2 });
  });

  it("hanya memanggil fetch untuk vendor yang belum ada di cache (permintaan parsial)", async () => {
    process.env.AZURE_MAPS_KEY = "kunci-uji";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => buatResponMatrix([{ statusCode: 200, lengthInMeters: 500, travelTimeInSeconds: 120 }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => buatResponMatrix([{ statusCode: 200, lengthInMeters: 900, travelTimeInSeconds: 240 }]),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await hitungJarakWaktuBanyakTujuan(lokasiUGM, [{ id: "v1", latitude: -7.76, longitude: 110.37 }]);

    const hasil = await hitungJarakWaktuBanyakTujuan(lokasiUGM, [
      { id: "v1", latitude: -7.76, longitude: 110.37 }, // dari cache
      { id: "v2", latitude: -7.77, longitude: 110.38 }, // baru, harus fetch
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(hasil.get("v1")).toEqual({ jarakMeter: 500, waktuTempuhMenit: 2 });
    expect(hasil.get("v2")).toEqual({ jarakMeter: 900, waktuTempuhMenit: 4 });

    // Permintaan kedua hanya berisi v2 (v1 sudah di-cache)
    const bodyPermintaanKedua = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
    expect(bodyPermintaanKedua.destinations.coordinates).toHaveLength(1);
  });

  it("mengembalikan Map kosong tanpa memanggil fetch bila tujuan kosong", async () => {
    process.env.AZURE_MAPS_KEY = "kunci-uji";
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const hasil = await hitungJarakWaktuBanyakTujuan(lokasiUGM, []);

    expect(hasil.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
