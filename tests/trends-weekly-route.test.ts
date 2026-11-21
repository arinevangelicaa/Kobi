import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));

const findManyMock = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { checkin: { findMany: (...a: unknown[]) => findManyMock(...a) } } }));

import { GET } from "@/app/api/trends/weekly/route";
import { BATAS, resetPembatasLaju } from "@/lib/rate-limit";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function req(query = "") {
  return new Request(`http://localhost/api/trends/weekly${query}`);
}

function baris(energi: number, fokus: number, protein: number | null) {
  return {
    tingkat_energi: energi,
    tingkat_fokus: fokus,
    meal_log: { nutrition_estimate: protein === null ? null : { protein_g: String(protein) } },
  };
}

beforeEach(() => {
  authMock.mockReset();
  findManyMock.mockReset();
  resetPembatasLaju();
  delete process.env.AZURE_OPENAI_ENDPOINT;
  delete process.env.AZURE_OPENAI_API_KEY;
  delete process.env.AZURE_OPENAI_DEPLOYMENT;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("GET /api/trends/weekly", () => {
  it("401 tanpa sesi dan tidak menyentuh DB", async () => {
    authMock.mockResolvedValue(null);

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("400 untuk parameter minggu tidak valid", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });

    const res = await GET(req("?minggu=kemarin"));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("keadaan kosong: status data_kurang, narasi template, disclaimer tetap ada", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    findManyMock.mockResolvedValue([]);

    const res = await GET(req("?minggu=2026-11-18"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.minggu).toEqual({ mulai: "2026-11-16", selesai: "2026-11-22" });
    expect(body.status).toBe("data_kurang");
    expect(body.jumlah_checkin).toBe(0);
    expect(body.narasi.sumber).toBe("template");
    expect(body.disclaimer).toMatch(/bukan diagnosis medis/);
  });

  it("user_id diambil dari sesi, bukan dari query", async () => {
    authMock.mockResolvedValue({ user: { id: "u-sesi" } });
    findManyMock.mockResolvedValue([]);

    await GET(req("?minggu=2026-11-18&user_id=u-orang-lain"));

    expect(findManyMock.mock.calls[0]?.[0].where.user_id).toBe("u-sesi");
  });

  it("data cukup tanpa Azure: agregasi dihitung di kode, narasi template", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    findManyMock.mockResolvedValue([baris(2, 2, 5), baris(3, 3, 6), baris(4, 4, 15), baris(5, 4, 16)]);

    const res = await GET(req("?minggu=2026-11-18"));
    const body = await res.json();

    expect(body.status).toBe("ok");
    expect(body.jumlah_checkin).toBe(4);
    expect(body.rata_energi).toBe(3.5);
    expect(body.per_rentang_protein).toHaveLength(3);
    expect(body.narasi.sumber).toBe("template");
    expect(body.narasi.teks).toContain("4 check-in");
    expect(body.disclaimer).toMatch(/bukan diagnosis medis/);
  });

  it("memakai narasi model bila lolos validasi", async () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://contoh.openai.azure.com";
    process.env.AZURE_OPENAI_API_KEY = "kunci-uji";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-kobi";
    authMock.mockResolvedValue({ user: { id: "u1" } });
    findManyMock.mockResolvedValue([baris(2, 2, 5), baris(3, 3, 6), baris(4, 4, 15)]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify({ kalimat: ["Minggu ini Anda mengisi 3 check-in."] }) },
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const body = await (await GET(req("?minggu=2026-11-18"))).json();

    expect(body.narasi).toEqual({ teks: "Minggu ini Anda mengisi 3 check-in.", sumber: "model" });
  });

  it("429 + Retry-After setelah melewati batas; DB dan Azure tidak dipanggil saat ditolak", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    findManyMock.mockResolvedValue([]);
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    for (let i = 0; i < BATAS.trenMingguan.maks; i++) {
      expect((await GET(req("?minggu=2026-11-18"))).status).toBe(200);
    }
    findManyMock.mockClear();

    const res = await GET(req("?minggu=2026-11-18"));

    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
    const detik = Number(res.headers.get("Retry-After"));
    expect(detik).toBeGreaterThanOrEqual(1);
    expect(detik).toBeLessThanOrEqual(BATAS.trenMingguan.jendelaMs / 1000);
    expect(findManyMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("batas per pengguna: pengguna lain tetap lolos", async () => {
    findManyMock.mockResolvedValue([]);
    authMock.mockResolvedValue({ user: { id: "u1" } });
    for (let i = 0; i <= BATAS.trenMingguan.maks; i++) await GET(req());

    authMock.mockResolvedValue({ user: { id: "u2" } });
    expect((await GET(req())).status).toBe(200);
  });

  it("galat koneksi DB menjadi 503 tanpa detail internal", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    findManyMock.mockRejectedValue(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(req());

    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("ECONNREFUSED");
  });
});
