import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));

import {
  apakahDbTidakTersedia,
  denganPenangananGalat,
  errorResponse,
  requireUser,
  tanganiGalat,
} from "@/lib/api";

beforeEach(() => {
  authMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("errorResponse", () => {
  it("memakai format error seragam", async () => {
    const res = errorResponse(400, "VALIDATION_ERROR", "Input salah.");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Input salah." },
    });
  });
});

describe("requireUser", () => {
  it("401 JSON bila tidak ada sesi", async () => {
    authMock.mockResolvedValue(null);
    const hasil = await requireUser("Harus login.");
    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.response.status).toBe(401);
    expect(await hasil.response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Harus login." },
    });
  });

  it("401 bila sesi ada tetapi tanpa user id", async () => {
    authMock.mockResolvedValue({ user: {} });
    const hasil = await requireUser();
    expect(hasil.ok).toBe(false);
  });

  it("mengembalikan userId dari sesi", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const hasil = await requireUser();
    expect(hasil).toEqual({ ok: true, userId: "user-1" });
  });
});

describe("apakahDbTidakTersedia", () => {
  it("mengenali kode Prisma dan kode soket Node", () => {
    expect(apakahDbTidakTersedia({ code: "P1001" })).toBe(true);
    expect(apakahDbTidakTersedia({ code: "P2024" })).toBe(true);
    expect(apakahDbTidakTersedia({ code: "ECONNREFUSED" })).toBe(true);
  });

  it("menelusuri rantai cause", () => {
    const galat = new Error("gagal query", { cause: { code: "ETIMEDOUT" } });
    expect(apakahDbTidakTersedia(galat)).toBe(true);
  });

  it("mengenali PrismaClientInitializationError dari namanya", () => {
    const galat = Object.assign(new Error("tidak bisa konek"), {
      name: "PrismaClientInitializationError",
    });
    expect(apakahDbTidakTersedia(galat)).toBe(true);
  });

  it("galat biasa dan nilai bukan objek bukan masalah koneksi", () => {
    expect(apakahDbTidakTersedia(new Error("bug"))).toBe(false);
    expect(apakahDbTidakTersedia({ code: "P2002" })).toBe(false);
    expect(apakahDbTidakTersedia("ECONNREFUSED")).toBe(false);
    expect(apakahDbTidakTersedia(null)).toBe(false);
  });

  it("tidak berputar tanpa henti pada cause melingkar", () => {
    const a: { cause?: unknown } = {};
    a.cause = a;
    expect(apakahDbTidakTersedia(a)).toBe(false);
  });
});

describe("tanganiGalat", () => {
  it("503 berbahasa Indonesia untuk DB tidak terjangkau, tanpa detail internal", async () => {
    const res = tanganiGalat(new Error("connect ECONNREFUSED 10.0.0.5:5432", { cause: { code: "ECONNREFUSED" } }));
    expect(res.status).toBe(503);
    const badan = await res.json();
    expect(badan.error.code).toBe("DB_UNAVAILABLE");
    expect(JSON.stringify(badan)).not.toContain("10.0.0.5");
  });

  it("500 generik untuk galat lain, tanpa membocorkan pesan asli", async () => {
    const res = tanganiGalat(new Error("rahasia internal"));
    expect(res.status).toBe(500);
    const badan = await res.json();
    expect(badan.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(badan)).not.toContain("rahasia");
  });
});

describe("denganPenangananGalat", () => {
  it("meneruskan respons handler apa adanya", async () => {
    const handler = denganPenangananGalat(async () => errorResponse(400, "VALIDATION_ERROR", "salah"));
    const res = await handler();
    expect(res.status).toBe(400);
  });

  it("mengubah throw menjadi respons", async () => {
    const handler = denganPenangananGalat(async () => {
      throw Object.assign(new Error("x"), { code: "P1001" });
    });
    const res = await handler();
    expect(res.status).toBe(503);
  });
});

describe("request_id pada galat", () => {
  function barisLogTerakhir() {
    const panggilan = vi.mocked(console.error).mock.calls;
    return JSON.parse(String(panggilan[panggilan.length - 1][0]));
  }

  it("tanganiGalat mencatat satu baris JSON berisi request_id yang sama dengan header respons", () => {
    const res = tanganiGalat(new Error("boom"));
    const log = barisLogTerakhir();
    expect(log.level).toBe("error");
    expect(log.request_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("x-request-id")).toBe(log.request_id);
  });

  it("denganPenangananGalat memakai x-request-id masuk yang aman", async () => {
    const handler = denganPenangananGalat(async (req: Request) => {
      void req;
      throw new Error("boom");
    });
    const res = await handler(
      new Request("http://x/api", { headers: { "x-request-id": "abc-12345678" } }),
    );
    expect(res.status).toBe(500);
    expect(res.headers.get("x-request-id")).toBe("abc-12345678");
    expect(barisLogTerakhir().request_id).toBe("abc-12345678");
  });

  it("respons error biasa di dalam handler juga membawa x-request-id", async () => {
    const handler = denganPenangananGalat(async (req: Request) => {
      void req;
      return errorResponse(400, "VALIDATION_ERROR", "salah");
    });
    const res = await handler(new Request("http://x/api"));
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("log galat tidak memuat rahasia dari pesan galat berisi URL koneksi", () => {
    tanganiGalat(new Error("gagal ke postgresql://kobi:sangat-rahasia@db:5432/kobi"));
    const teks = String(vi.mocked(console.error).mock.calls.at(-1)?.[0]);
    expect(teks).not.toContain("sangat-rahasia");
  });
});
