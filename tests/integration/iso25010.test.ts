/**
 * Pengujian kualitas ISO/IEC 25010:2011 (worksheet Modul 11, bagian kedua).
 *
 * Model: Software Product Quality. Tiga karakteristik yang diuji:
 *   FS  - Functional Suitability (completeness, correctness, appropriateness)
 *   SEC - Security (authenticity, confidentiality, integrity, accountability dasar)
 *   REL - Reliability (fault tolerance, recoverability, maturity)
 *
 * Tiap `it` diawali ID (mis. SEC-02) supaya scripts/laporan-pengujian.ts bisa
 * memetakan hasilnya ke tabel laporan. Semua dijalankan terhadap Postgres
 * sungguhan lewat Route Handler yang asli.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as checkinPost } from "@/app/api/checkins/route";
import { POST as estimatePost } from "@/app/api/meals/[id]/estimate/route";
import { GET as mealsGet, POST as mealsPost } from "@/app/api/meals/route";
import { GET as dailyGet } from "@/app/api/nutrition/daily/route";
import { GET as profileGet, PATCH as profilePatch } from "@/app/api/profile/route";
import { POST as rekomendasiPost } from "@/app/api/recommendations/route";
import { DELETE as scheduleDelete } from "@/app/api/schedules/[id]/route";
import { GET as schedulesGet, POST as schedulesPost } from "@/app/api/schedules/route";
import { GET as trendsGet } from "@/app/api/trends/weekly/route";
import { BATAS } from "@/lib/rate-limit";
import { hitungKesenjangan } from "@/lib/services/nutrition-gap";
import { hitungTargetGizi } from "@/lib/services/nutrition-target";

import {
  buatRequest,
  buatUser,
  emailUnik,
  get,
  masukSebagai,
  pakaiDbBersih,
  paramsId,
  pasangAzureOpenAI,
  patch,
  post,
  prisma,
} from "./helpers";

pakaiDbBersih();

// Spy pada prisma/console dipulihkan walau assertion gagal, supaya tidak bocor ke tes berikutnya.
afterEach(() => {
  vi.restoreAllMocks();
});

const SIANG_WIB = "2026-11-21T12:00:00+07:00";
const UUID_ACAK = "3f2b8c1e-9d4a-4e6b-8a1c-2d5f7e9b0a13";

const meal = (userId: string, teks = "nasi telur") =>
  prisma.mealLog.create({ data: { user_id: userId, teks_input: teks, waktu_makan: new Date(SIANG_WIB) } });

// ===========================================================================
// FS - Functional Suitability
// ===========================================================================

describe("Functional Suitability", () => {
  it("FS-01 completeness: setiap operasi pada profil operasional punya handler yang dapat dipanggil", () => {
    const handler = {
      register: registerPost,
      "profil (GET)": profileGet,
      "profil (PATCH)": profilePatch,
      "jadwal (GET)": schedulesGet,
      "jadwal (POST)": schedulesPost,
      "jadwal (DELETE)": scheduleDelete,
      "catat makan (POST)": mealsPost,
      "riwayat makan (GET)": mealsGet,
      reproses: estimatePost,
      "gizi harian": dailyGet,
      "check-in": checkinPost,
      rekomendasi: rekomendasiPost,
      tren: trendsGet,
    };
    for (const [nama, fn] of Object.entries(handler)) {
      expect(typeof fn, nama).toBe("function");
    }
  });

  it("FS-02 correctness: target gizi sama dengan hitungan manual Mifflin-St Jeor (perempuan 23 th, 55,5 kg, 160 cm)", () => {
    // BMR = 10*55.5 + 6.25*160 - 5*23 - 161 = 1279; TDEE = 1279*1.375 = 1758.6 -> 1759 kkal.
    // Protein = max(1.2*55.5 = 66.6; 1759*0.15/4 = 65.96) = 66.6 -> 67 g.
    // Lemak = 1759*0.25/9 = 48.9 -> 49 g. Karbo = (1759 - 67*4 - 49*9)/4 = 262.5 -> 263 g. Zat besi 18 mg.
    const hasil = hitungTargetGizi(
      { tanggal_lahir: "2003-05-10", jenis_kelamin: "P", berat_badan_kg: 55.5, tinggi_badan_cm: 160 },
      new Date("2026-11-21T00:00:00Z"),
    );
    expect(hasil).toEqual({
      kalori_target: 1759,
      protein_target_g: 67,
      karbohidrat_target_g: 263,
      lemak_target_g: 49,
      zat_besi_target_mg: 18,
    });
  });

  it("FS-03 correctness: kesenjangan = target - asupan, tidak pernah negatif, terurut dari yang paling kurang", () => {
    const hasil = hitungKesenjangan(
      { protein_g: 60, karbohidrat_g: 300, lemak_g: 60, zat_besi_mg: 18, kalori: 2000 },
      { protein_g: 80, karbohidrat_g: 100, lemak_g: 30, zat_besi_mg: 18, kalori: 1200 },
    );
    const kurang = Object.fromEntries(hasil.map((k) => [k.zat, k.kurang]));
    expect(kurang).toEqual({ protein_g: 0, karbohidrat_g: 200, lemak_g: 30, zat_besi_mg: 0 });
    expect(hasil[0]?.zat).toBe("karbohidrat_g");
    expect(hasil.map((k) => k.zat)).not.toContain("kalori");
  });

  it("FS-04 appropriateness: tren memuat disclaimer; narasi model yang berisi klaim diagnosis ditolak dan diganti template", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    for (const [hari, e, f] of [["2026-11-16", 5, 2], ["2026-11-18", 3, 3], ["2026-11-20", 4, 4]] as const) {
      const m = await prisma.mealLog.create({
        data: { user_id: user.id, teks_input: "makan", waktu_makan: new Date(`${hari}T05:00:00Z`) },
      });
      await prisma.checkin.create({ data: { user_id: user.id, meal_log_id: m.id, tingkat_energi: e, tingkat_fokus: f } });
    }
    // Model "berhalusinasi" klaim medis dan sebab-akibat; harus ditolak.
    const kalimatBuruk = ["Kekurangan protein menyebabkan Anda lelah.", "Ini gejala anemia dan penyakit serius."];
    const fetchModel = vi.fn(async () =>
      new Response(
        JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ kalimat: kalimatBuruk }) } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchModel);

    const badan = await (await trendsGet(get("/api/trends/weekly?minggu=2026-11-18"))).json();

    expect(badan.status).toBe("ok");
    expect(fetchModel).toHaveBeenCalled(); // jalur model benar-benar dipakai
    expect(badan.narasi.sumber).toBe("template");
    expect(badan.narasi.teks).not.toMatch(/diagnos|penyakit|gejala|anemia|menyebabkan/i);
    expect(badan.disclaimer).toMatch(/bukan diagnosis medis/i);
  });
});

// ===========================================================================
// SEC - Security
// ===========================================================================

describe("Security", () => {
  it("SEC-01 authenticity: semua endpoint terlindungi menjawab 401 tanpa sesi", async () => {
    masukSebagai(null);
    pasangAzureOpenAI();
    const panggilan: [string, () => Promise<Response>][] = [
      ["GET /api/profile", () => profileGet()],
      ["PATCH /api/profile", () => profilePatch(patch("/api/profile", { nama: "X" }))],
      ["GET /api/schedules", () => schedulesGet()],
      ["POST /api/schedules", () => schedulesPost(post("/api/schedules", {}))],
      ["DELETE /api/schedules/[id]", () => scheduleDelete(buatRequest("DELETE", "/x"), paramsId(UUID_ACAK))],
      ["POST /api/meals", () => mealsPost(post("/api/meals", { teks_input: "nasi" }))],
      ["GET /api/meals", () => mealsGet(get("/api/meals"))],
      ["POST /api/meals/[id]/estimate", () => estimatePost(buatRequest("POST", "/x"), paramsId(UUID_ACAK))],
      ["GET /api/nutrition/daily", () => dailyGet(get("/api/nutrition/daily"))],
      ["POST /api/checkins", () => checkinPost(post("/api/checkins", {}))],
      ["GET /api/trends/weekly", () => trendsGet(get("/api/trends/weekly"))],
      ["POST /api/recommendations", () => rekomendasiPost(post("/api/recommendations", {}))],
    ];

    for (const [nama, panggil] of panggilan) {
      const res = await panggil();
      expect(res.status, nama).toBe(401);
    }
  });

  it("SEC-02 authorization: pengguna B tidak dapat membaca atau mengubah data pengguna A", async () => {
    pasangAzureOpenAI();
    const a = await buatUser("A");
    const b = await buatUser("B");
    const mealA = await meal(a.id, "rahasia A");
    const jadwalA = await prisma.classSchedule.create({
      data: {
        user_id: a.id,
        mata_kuliah: "Jadwal A",
        hari: 1,
        jam_mulai: new Date("1970-01-01T07:00:00Z"),
        jam_selesai: new Date("1970-01-01T09:00:00Z"),
      },
    });
    masukSebagai(b.id);

    const reproses = await estimatePost(buatRequest("POST", "/x"), paramsId(mealA.id));
    const cek = await checkinPost(post("/api/checkins", { meal_log_id: mealA.id, tingkat_energi: 3, tingkat_fokus: 3 }));
    const hapus = await scheduleDelete(buatRequest("DELETE", "/x"), paramsId(jadwalA.id));
    const riwayat = await (await mealsGet(get("/api/meals?tanggal=2026-11-21"))).json();
    const jadwalB = await (await schedulesGet()).json();

    for (const res of [reproses, cek, hapus]) {
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    }
    expect(riwayat.count).toBe(0);
    expect(jadwalB.schedules).toHaveLength(0);
    // Data A utuh.
    expect(await prisma.checkin.count()).toBe(0);
    expect(await prisma.nutritionEstimate.count()).toBe(0);
    expect(await prisma.classSchedule.count({ where: { id: jadwalA.id } })).toBe(1);
  });

  it("SEC-03 confidentiality: password tidak pernah ada di respons maupun tersimpan mentah", async () => {
    const email = emailUnik("sec03");
    const password = "kata-sandi-rahasia-987";
    const reg = await registerPost(post("/api/auth/register", { email, password, nama: "Uji Rahasia" }));
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    masukSebagai(user.id);
    const profil = await profileGet();

    const teks = (await reg.text()) + (await profil.text());
    expect(teks).not.toContain(password);
    expect(teks).not.toMatch(/argon2|password_hash/i);
    const mentah = await prisma.$queryRaw<{ ada: boolean }[]>`
      SELECT (row_to_json(u)::text LIKE ${"%" + password + "%"}) AS ada FROM users u WHERE u.email = ${email}`;
    expect(mentah[0]?.ada).toBe(false);
  });

  it("SEC-04 integrity: payload SQL injection disimpan sebagai data, user_id palsu di body diabaikan", async () => {
    const korban = await buatUser("Korban");
    const penyerang = await buatUser("Penyerang");
    masukSebagai(penyerang.id);
    pasangAzureOpenAI();
    const payload = "'; DROP TABLE users; -- <script>alert(1)</script>";

    const res = await mealsPost(
      post("/api/meals", { teks_input: payload, waktu_makan: SIANG_WIB, user_id: korban.id }),
    );

    expect(res.status).toBeLessThan(500);
    expect(await prisma.user.count()).toBe(2); // tabel users masih ada
    if (res.status === 201) {
      const baris = await prisma.mealLog.findFirstOrThrow();
      expect(baris.user_id).toBe(penyerang.id); // bukan korban
      expect(baris.teks_input).toBe(payload);
    }
    expect(await prisma.mealLog.count({ where: { user_id: korban.id } })).toBe(0);
  });

  it("SEC-05 availability/abuse: permintaan melebihi batas catat makan dijawab 429 dengan Retry-After", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    pasangAzureOpenAI();

    let terakhir: Response | undefined;
    for (let i = 0; i < BATAS.catatMakan.maks + 1; i++) {
      terakhir = await mealsPost(post("/api/meals", { teks_input: `nasi ${i}`, waktu_makan: SIANG_WIB }));
    }

    expect(terakhir?.status).toBe(429);
    expect(Number(terakhir?.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("SEC-06 confidentiality: galat internal tidak membocorkan detail SQL atau stack ke klien", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sql = vi.spyOn(prisma.mealLog, "findMany").mockRejectedValue(new Error('relation "meal_logs" does not exist at /srv/app/lib/db.ts:42'));

    const res = await mealsGet(get("/api/meals?tanggal=2026-11-21"));
    const teks = await res.text();

    expect(res.status).toBe(500);
    expect(teks).not.toMatch(/relation|meal_logs|\/srv\/|\.ts:\d+|at /);
    sql.mockRestore();
  });
});

// ===========================================================================
// REL - Reliability
// ===========================================================================

describe("Reliability", () => {
  it("REL-01 fault tolerance: layanan AI gagal (HTTP 500 dan timeout), catatan tetap tersimpan", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    const azure = pasangAzureOpenAI("http500");

    const a = await mealsPost(post("/api/meals", { teks_input: "nasi satu", waktu_makan: SIANG_WIB }));
    azure.atur("timeout");
    const b = await mealsPost(post("/api/meals", { teks_input: "nasi dua", waktu_makan: SIANG_WIB }));

    expect([a.status, b.status]).toEqual([201, 201]);
    expect((await a.json()).estimasi_tertunda).toBe(true);
    expect((await b.json()).estimasi_tertunda).toBe(true);
    expect(await prisma.mealLog.count({ where: { user_id: user.id } })).toBe(2);
  });

  it("REL-02 fault tolerance: basis data tidak terjangkau dijawab 503 DB_UNAVAILABLE (bukan 500) pada endpoint baca", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const galat = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
    const s1 = vi.spyOn(prisma.mealLog, "findMany").mockRejectedValue(galat);
    const s2 = vi.spyOn(prisma.nutritionTarget, "findMany").mockRejectedValue(galat);
    const s3 = vi.spyOn(prisma.nutritionTarget, "findFirst").mockRejectedValue(galat);

    const riwayat = await mealsGet(get("/api/meals?tanggal=2026-11-21"));
    const harian = await dailyGet(get("/api/nutrition/daily?tanggal=2026-11-21"));

    expect(riwayat.status).toBe(503);
    expect((await riwayat.json()).error.code).toBe("DB_UNAVAILABLE");
    expect(harian.status).toBe(503);
    for (const s of [s1, s2, s3]) s.mockRestore();
  });

  it("REL-03 recoverability: reproses setelah AI pulih melengkapi estimasi; reproses ganda tidak membuat estimasi ganda", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    const azure = pasangAzureOpenAI("http500");
    const dibuat = await (await mealsPost(post("/api/meals", { teks_input: "nasi goreng", waktu_makan: SIANG_WIB }))).json();
    const id = dibuat.meal.id as string;
    azure.atur("berhasil");

    const [x, y] = await Promise.all([
      estimatePost(buatRequest("POST", "/x"), paramsId(id)),
      estimatePost(buatRequest("POST", "/x"), paramsId(id)),
    ]);

    expect(x.status).toBeLessThan(500);
    expect(y.status).toBeLessThan(500);
    expect(await prisma.nutritionEstimate.count({ where: { meal_log_id: id } })).toBe(1);
  });

  it("REL-04 fault tolerance: body bukan JSON atau bertipe salah dijawab 400, tidak pernah 500", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    pasangAzureOpenAI();
    const badanRusak: unknown[] = ["bukan json", "null", "[]", "123", '"teks"', "{"];
    const target: [string, (b: string) => Promise<Response>][] = [
      ["register", (b) => registerPost(buatRequest("POST", "/api/auth/register", b))],
      ["meals", (b) => mealsPost(buatRequest("POST", "/api/meals", b))],
      ["checkins", (b) => checkinPost(buatRequest("POST", "/api/checkins", b))],
      ["schedules", (b) => schedulesPost(buatRequest("POST", "/api/schedules", b))],
      ["recommendations", (b) => rekomendasiPost(buatRequest("POST", "/api/recommendations", b))],
      ["profile", (b) => profilePatch(buatRequest("PATCH", "/api/profile", b))],
    ];

    for (const [nama, panggil] of target) {
      for (const b of badanRusak) {
        const res = await panggil(b as string);
        expect(res.status, `${nama} <- ${String(b)}`).toBe(400);
      }
    }
  });

  it("REL-05 maturity: lima catat makan bersamaan semuanya tersimpan, tidak ada yang hilang atau ganda", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    pasangAzureOpenAI();

    const hasil = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        mealsPost(post("/api/meals", { teks_input: `makan ${i}`, waktu_makan: SIANG_WIB })),
      ),
    );

    expect(hasil.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
    expect(await prisma.mealLog.count({ where: { user_id: user.id } })).toBe(5);
    expect(await prisma.nutritionEstimate.count()).toBe(5);
  });

  it("REL-06 maturity: register bersamaan dengan email sama menghasilkan tepat satu akun (tanpa 500)", async () => {
    const email = emailUnik("rel06");
    const hasil = await Promise.all(
      Array.from({ length: 4 }, () =>
        registerPost(post("/api/auth/register", { email, password: "panjangnya-cukup-1", nama: "Balapan" })),
      ),
    );

    const status = hasil.map((r) => r.status).sort();
    expect(status.filter((s) => s === 201)).toHaveLength(1);
    expect(status.every((s) => s === 201 || s === 409)).toBe(true);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });
});
