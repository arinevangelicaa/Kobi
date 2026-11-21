import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));

const catatMakanMock = vi.fn();
const riwayatMock = vi.fn();
const reprosesMock = vi.fn();
vi.mock("@/lib/services/meal", () => ({
  catatMakan: (...a: unknown[]) => catatMakanMock(...a),
  riwayatMakanHarian: (...a: unknown[]) => riwayatMock(...a),
  reprosesEstimasi: (...a: unknown[]) => reprosesMock(...a),
}));

const gizi = vi.fn();
vi.mock("@/lib/services/daily-nutrition", () => ({
  dapatkanGiziHarian: (...a: unknown[]) => gizi(...a),
}));

const buatCheckinMock = vi.fn();
vi.mock("@/lib/services/meal-checkin", () => ({
  buatCheckin: (...a: unknown[]) => buatCheckinMock(...a),
}));

import { POST as checkinPost } from "@/app/api/checkins/route";
import { POST as estimatePost } from "@/app/api/meals/[id]/estimate/route";
import { GET as mealsGet, POST as mealsPost } from "@/app/api/meals/route";
import { GET as dailyGet } from "@/app/api/nutrition/daily/route";
import { BATAS, resetPembatasLaju } from "@/lib/rate-limit";

const UUID = "3f2b8c1e-9d4a-4e6b-8a1c-2d5f7e9b0a13";

function post(url: string, body: unknown) {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const get = (url: string) => new Request(`http://localhost${url}`);

const catatan = {
  id: UUID,
  teks_input: "nasi telur",
  vendor_id: null,
  total_harga: 12000,
  waktu_makan: "2026-11-21T05:30:00.000Z",
  dibuat_pada: "2026-11-21T05:30:01.000Z",
  estimasi: { kalori_estimasi: 520, tingkat_keyakinan: 0.3 },
  estimasi_tertunda: false,
  rendah_keyakinan: true,
};

beforeEach(() => {
  for (const m of [authMock, catatMakanMock, riwayatMock, reprosesMock, gizi, buatCheckinMock]) {
    m.mockReset();
  }
  resetPembatasLaju();
  authMock.mockResolvedValue({ user: { id: "user-sesi" } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/meals", () => {
  it("401 tanpa sesi dan tidak menyentuh service", async () => {
    authMock.mockResolvedValue(null);
    const res = await mealsPost(post("/api/meals", { teks_input: "nasi" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    expect(catatMakanMock).not.toHaveBeenCalled();
  });

  it("400 untuk input tidak valid dan body bukan JSON", async () => {
    const a = await mealsPost(post("/api/meals", { teks_input: "" }));
    const b = await mealsPost(post("/api/meals", "bukan json"));
    expect(a.status).toBe(400);
    expect((await a.json()).error.code).toBe("VALIDATION_ERROR");
    expect(b.status).toBe(400);
    expect(catatMakanMock).not.toHaveBeenCalled();
  });

  it("201 dengan catatan, items, penanda, dan gizi_harian; user_id dari sesi bukan body", async () => {
    catatMakanMock.mockResolvedValue({
      status: "tersimpan",
      catatan,
      items: [{ nama: "nasi", porsi: "1 piring" }],
    });
    gizi.mockResolvedValue({ tanggal: "2026-11-21", kesenjangan: [] });

    const res = await mealsPost(
      post("/api/meals", { teks_input: "nasi telur", user_id: "penyusup" }),
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.meal).toEqual(catatan);
    expect(json.items).toHaveLength(1);
    expect(json.estimasi_tertunda).toBe(false);
    expect(json.rendah_keyakinan).toBe(true);
    expect(json.gizi_harian.tanggal).toBe("2026-11-21");
    expect(catatMakanMock.mock.calls[0]?.[0]).toBe("user-sesi");
    expect(gizi.mock.calls[0]?.[0]).toBe("user-sesi");
    expect(JSON.stringify(catatMakanMock.mock.calls[0])).not.toContain("penyusup");
  });

  it("estimasi tertunda tetap 201 dengan estimasi_tertunda true", async () => {
    catatMakanMock.mockResolvedValue({
      status: "tersimpan",
      catatan: { ...catatan, estimasi: null, estimasi_tertunda: true, rendah_keyakinan: false },
      items: [],
    });
    gizi.mockResolvedValue({ tanggal: "2026-11-21" });

    const res = await mealsPost(post("/api/meals", { teks_input: "nasi telur" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.estimasi_tertunda).toBe(true);
    expect(json.meal.estimasi).toBeNull();
  });

  it("vendor_id yang tidak ada dibalas 400, bukan 500", async () => {
    catatMakanMock.mockResolvedValue({ status: "vendor_tidak_valid" });
    const res = await mealsPost(post("/api/meals", { teks_input: "nasi", vendor_id: UUID }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VENDOR_NOT_FOUND");
  });

  it("gagal menghitung gizi_harian tidak menggagalkan respons: gizi_harian null", async () => {
    catatMakanMock.mockResolvedValue({ status: "tersimpan", catatan, items: [] });
    gizi.mockRejectedValue(new Error("db sebentar mati"));

    const res = await mealsPost(post("/api/meals", { teks_input: "nasi" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.gizi_harian).toBeNull();
  });

  it("DB tidak terjangkau saat menyimpan: 503", async () => {
    catatMakanMock.mockRejectedValue(Object.assign(new Error("x"), { code: "P1001" }));
    const res = await mealsPost(post("/api/meals", { teks_input: "nasi" }));
    expect(res.status).toBe(503);
  });
});

describe("rate limit POST /api/meals", () => {
  it("429 + Retry-After setelah melewati batas; service (AI/DB) tidak dipanggil saat ditolak", async () => {
    catatMakanMock.mockResolvedValue({ status: "tersimpan", catatan, items: [] });
    gizi.mockResolvedValue(null);

    for (let i = 0; i < BATAS.catatMakan.maks; i++) {
      expect((await mealsPost(post("/api/meals", { teks_input: "nasi" }))).status).toBe(201);
    }
    catatMakanMock.mockClear();
    gizi.mockClear();

    const res = await mealsPost(post("/api/meals", { teks_input: "nasi" }));
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
    const detik = Number(res.headers.get("Retry-After"));
    expect(detik).toBeGreaterThanOrEqual(1);
    expect(detik).toBeLessThanOrEqual(BATAS.catatMakan.jendelaMs / 1000);
    expect(catatMakanMock).not.toHaveBeenCalled();
    expect(gizi).not.toHaveBeenCalled();
  });

  it("batas per pengguna: pengguna lain tetap lolos", async () => {
    catatMakanMock.mockResolvedValue({ status: "tersimpan", catatan, items: [] });
    gizi.mockResolvedValue(null);
    for (let i = 0; i <= BATAS.catatMakan.maks; i++) {
      await mealsPost(post("/api/meals", { teks_input: "nasi" }));
    }
    authMock.mockResolvedValue({ user: { id: "user-lain" } });
    expect((await mealsPost(post("/api/meals", { teks_input: "nasi" }))).status).toBe(201);
  });

  it("401 tidak menghabiskan kuota dan tidak dibatasi", async () => {
    authMock.mockResolvedValue(null);
    for (let i = 0; i <= BATAS.catatMakan.maks; i++) {
      expect((await mealsPost(post("/api/meals", { teks_input: "nasi" }))).status).toBe(401);
    }
  });

  it("GET riwayat tidak dibatasi (tidak memanggil AI)", async () => {
    riwayatMock.mockResolvedValue({ tanggal: "2026-11-21", meals: [] });
    for (let i = 0; i <= BATAS.catatMakan.maks; i++) {
      expect((await mealsGet(get("/api/meals"))).status).toBe(200);
    }
  });
});

describe("GET /api/meals", () => {
  it("401 tanpa sesi", async () => {
    authMock.mockResolvedValue(null);
    expect((await mealsGet(get("/api/meals"))).status).toBe(401);
  });

  it("400 untuk tanggal tidak valid", async () => {
    const res = await mealsGet(get("/api/meals?tanggal=besok"));
    expect(res.status).toBe(400);
    expect(riwayatMock).not.toHaveBeenCalled();
  });

  it("200 dengan riwayat hari yang diminta", async () => {
    riwayatMock.mockResolvedValue({
      tanggal: "2026-11-21",
      meals: [{ ...catatan, sudah_checkin: false }],
    });

    const res = await mealsGet(get("/api/meals?tanggal=2026-11-21"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.count).toBe(1);
    expect(json.meals[0].estimasi_tertunda).toBe(false);
    expect(riwayatMock).toHaveBeenCalledWith("user-sesi", "2026-11-21");
  });

  it("tanpa tanggal memakai hari ini WIB", async () => {
    riwayatMock.mockResolvedValue({ tanggal: "x", meals: [] });
    await mealsGet(get("/api/meals"));
    expect(riwayatMock.mock.calls[0]?.[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("POST /api/meals/[id]/estimate", () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const req = () => post(`/api/meals/${UUID}/estimate`, {});

  it("401 tanpa sesi", async () => {
    authMock.mockResolvedValue(null);
    expect((await estimatePost(req(), params(UUID))).status).toBe(401);
  });

  it("404 bila service bilang tidak ditemukan (tidak ada atau bukan milik)", async () => {
    reprosesMock.mockResolvedValue({ status: "tidak_ditemukan" });
    const res = await estimatePost(req(), params(UUID));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
    expect(reprosesMock.mock.calls[0]?.slice(0, 2)).toEqual(["user-sesi", UUID]);
  });

  it("id yang bukan uuid juga 404 tanpa menyentuh service", async () => {
    const res = await estimatePost(req(), params("bukan-uuid"));
    expect(res.status).toBe(404);
    expect(reprosesMock).not.toHaveBeenCalled();
  });

  it("200 diproses dengan items", async () => {
    reprosesMock.mockResolvedValue({
      status: "diproses",
      catatan,
      items: [{ nama: "nasi", porsi: "1 piring" }],
    });
    const json = await (await estimatePost(req(), params(UUID))).json();
    expect(json.status).toBe("diproses");
    expect(json.items).toHaveLength(1);
    expect(json.estimasi_tertunda).toBe(false);
  });

  it("200 sudah_ada tanpa items (idempoten)", async () => {
    reprosesMock.mockResolvedValue({ status: "sudah_ada", catatan });
    const res = await estimatePost(req(), params(UUID));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe("sudah_ada");
    expect(json.items).toEqual([]);
  });

  it("200 tanpa_estimasi bila AI gagal lagi, tetap ditandai tertunda", async () => {
    reprosesMock.mockResolvedValue({
      status: "tanpa_estimasi",
      catatan: { ...catatan, estimasi: null, estimasi_tertunda: true, rendah_keyakinan: false },
    });
    const json = await (await estimatePost(req(), params(UUID))).json();
    expect(json.status).toBe("tanpa_estimasi");
    expect(json.estimasi_tertunda).toBe(true);
  });
});

describe("GET /api/nutrition/daily", () => {
  it("401 tanpa sesi", async () => {
    authMock.mockResolvedValue(null);
    expect((await dailyGet(get("/api/nutrition/daily"))).status).toBe(401);
  });

  it("400 untuk tanggal tidak valid", async () => {
    const res = await dailyGet(get("/api/nutrition/daily?tanggal=2026-13-45"));
    expect(res.status).toBe(400);
    expect(gizi).not.toHaveBeenCalled();
  });

  it("200 membalas hasil dapatkanGiziHarian untuk pengguna sesi dan tanggal itu", async () => {
    const ringkasan = { tanggal: "2026-11-21", target: null, asupan: {}, kesenjangan: [] };
    gizi.mockResolvedValue(ringkasan);

    const res = await dailyGet(get("/api/nutrition/daily?tanggal=2026-11-21"));

    expect(res.status).toBe(200);
    expect((await res.json()).gizi_harian).toEqual(ringkasan);
    expect(gizi).toHaveBeenCalledWith("user-sesi", "2026-11-21");
  });
});

describe("POST /api/checkins", () => {
  const valid = { meal_log_id: UUID, tingkat_energi: 4, tingkat_fokus: 3 };

  it("401 tanpa sesi", async () => {
    authMock.mockResolvedValue(null);
    expect((await checkinPost(post("/api/checkins", valid))).status).toBe(401);
  });

  it("400 untuk tingkat di luar 1-5", async () => {
    const res = await checkinPost(post("/api/checkins", { ...valid, tingkat_energi: 9 }));
    expect(res.status).toBe(400);
    expect(buatCheckinMock).not.toHaveBeenCalled();
  });

  it("201 bila sukses, memakai user_id dari sesi", async () => {
    const checkin = { id: "c1", meal_log_id: UUID, tingkat_energi: 4, tingkat_fokus: 3 };
    buatCheckinMock.mockResolvedValue({ status: "tersimpan", checkin });

    const res = await checkinPost(post("/api/checkins", { ...valid, user_id: "penyusup" }));

    expect(res.status).toBe(201);
    expect((await res.json()).checkin).toEqual(checkin);
    expect(buatCheckinMock.mock.calls[0]?.[0]).toBe("user-sesi");
    expect(JSON.stringify(buatCheckinMock.mock.calls[0])).not.toContain("penyusup");
  });

  it("404 bila meal_log bukan miliknya atau tidak ada", async () => {
    buatCheckinMock.mockResolvedValue({ status: "meal_tidak_ditemukan" });
    const res = await checkinPost(post("/api/checkins", valid));
    expect(res.status).toBe(404);
  });

  it("409 untuk check-in duplikat", async () => {
    buatCheckinMock.mockResolvedValue({ status: "sudah_ada" });
    const res = await checkinPost(post("/api/checkins", valid));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("CHECKIN_EXISTS");
  });
});
