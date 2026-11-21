import { describe, expect, it } from "vitest";

import { POST as registerPost } from "@/app/api/auth/register/route";
import { GET as profileGet, PATCH as profilePatch } from "@/app/api/profile/route";
import { DELETE as scheduleDelete } from "@/app/api/schedules/[id]/route";
import { GET as schedulesGet, POST as schedulesPost } from "@/app/api/schedules/route";
import { verifyPassword } from "@/lib/password";
import { hitungTargetGizi } from "@/lib/services/nutrition-target";

import {
  buatRequest,
  buatUser,
  emailUnik,
  masukSebagai,
  pakaiDbBersih,
  paramsId,
  patch,
  post,
  prisma,
} from "./helpers";

pakaiDbBersih();

async function daftar(email = emailUnik("reg"), password = "rahasia-sekali-123", nama = "Mahasiswa Uji") {
  const res = await registerPost(post("/api/auth/register", { email, password, nama }));
  return { res, email, password, nama };
}

describe("register (handler asli, DB sungguhan)", () => {
  it("201, menyimpan pengguna, dan password disimpan sebagai hash argon2id", async () => {
    const { res, email, password, nama } = await daftar();
    expect(res.status).toBe(201);

    const badan = await res.json();
    expect(badan).toMatchObject({ email, nama });
    expect(badan.password_hash).toBeUndefined();
    expect(badan.password).toBeUndefined();

    const baris = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(baris.password_hash).toMatch(/^\$argon2id\$/);
    expect(baris.password_hash).not.toContain(password);
    expect(await verifyPassword(baris.password_hash as string, password)).toBe(true);
    expect(await verifyPassword(baris.password_hash as string, "salah-total-123")).toBe(false);

    // Tidak ada kolom lain yang menyimpan password mentah.
    const mentah = await prisma.$queryRaw<{ ada: boolean }[]>`
      SELECT (row_to_json(u)::text LIKE ${"%" + password + "%"}) AS ada
      FROM users u WHERE u.email = ${email}`;
    expect(mentah[0]?.ada).toBe(false);
  });

  it("email dinormalkan ke huruf kecil dan duplikat (beda kapitalisasi) 409 EMAIL_TAKEN", async () => {
    const email = emailUnik("Dup");
    expect((await daftar(email)).res.status).toBe(201);

    const kedua = await daftar(email.toUpperCase());
    expect(kedua.res.status).toBe(409);
    expect((await kedua.res.json()).error.code).toBe("EMAIL_TAKEN");
    expect(await prisma.user.count()).toBe(1);
    expect((await prisma.user.findFirstOrThrow()).email).toBe(email.toLowerCase());
  });

  it("dua register bersamaan dengan email sama: satu 201, satu 409 (kode P2002 nyata dari unique email)", async () => {
    const email = emailUnik("balapan");
    const [a, b] = await Promise.all([daftar(email), daftar(email)]);

    expect([a.res.status, b.res.status].sort()).toEqual([201, 409]);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });

  it("asumsi tiruan terbukti: email duplikat di Postgres sungguhan memberi galat Prisma berkode P2002", async () => {
    const email = emailUnik("p2002");
    await prisma.user.create({ data: { email, nama: "Satu" } });

    // Kode yang dibaca handler register untuk menangkap balapan.
    await expect(prisma.user.create({ data: { email, nama: "Dua" } })).rejects.toMatchObject({ code: "P2002" });
  });

  it("400 untuk email, password pendek, dan body bukan JSON; tidak ada baris tersimpan", async () => {
    const a = await registerPost(post("/api/auth/register", { email: "bukan-email", password: "panjangnya-cukup", nama: "X" }));
    const b = await registerPost(post("/api/auth/register", { email: emailUnik(), password: "pendek", nama: "X" }));
    const c = await registerPost(buatRequest("POST", "/api/auth/register", "bukan json"));

    for (const res of [a, b, c]) {
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    }
    expect(await prisma.user.count()).toBe(0);
  });

  it("nama berisi NUL ditolak 400, bukan 500 dari Postgres; tidak ada baris tersimpan", async () => {
    const res = await registerPost(
      post("/api/auth/register", { email: emailUnik(), password: "panjangnya-cukup", nama: "Ad\u0000nan" }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.user.count()).toBe(0);
  });
});

describe("profil dan target gizi", () => {
  async function penggunaTerdaftar() {
    const { email } = await daftar();
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    masukSebagai(user.id);
    return user;
  }

  it("401 tanpa sesi", async () => {
    expect((await profileGet()).status).toBe(401);
    expect((await profilePatch(patch("/api/profile", { nama: "X" }))).status).toBe(401);
  });

  it("GET /api/profile pengguna baru: tanpa target gizi", async () => {
    const user = await penggunaTerdaftar();

    const res = await profileGet();
    expect(res.status).toBe(200);
    const badan = await res.json();
    expect(badan.user).toMatchObject({ id: user.id, email: user.email, berat_badan_kg: null });
    expect(badan.nutrition_target).toBeNull();
  });

  it("PATCH data fisik membuat baris nutrition_targets baru, GET mengembalikannya", async () => {
    const user = await penggunaTerdaftar();

    const res = await profilePatch(
      patch("/api/profile", {
        tanggal_lahir: "2003-05-10",
        jenis_kelamin: "P",
        berat_badan_kg: 55.5,
        tinggi_badan_cm: 160,
        preferensi_anggaran: 20000,
      }),
    );
    expect(res.status).toBe(200);
    const badan = await res.json();

    // Tanggal lahir (kolom DATE) kembali persis, tidak bergeser sehari karena TZ proses.
    expect(badan.user).toMatchObject({
      tanggal_lahir: "2003-05-10",
      jenis_kelamin: "P",
      berat_badan_kg: 55.5,
      tinggi_badan_cm: 160,
      preferensi_anggaran: 20000,
    });

    const target = await prisma.nutritionTarget.findMany({ where: { user_id: user.id } });
    expect(target).toHaveLength(1);

    const harapan = hitungTargetGizi({
      tanggal_lahir: new Date("2003-05-10"),
      jenis_kelamin: "P",
      berat_badan_kg: 55.5,
      tinggi_badan_cm: 160,
    });
    expect(target[0]?.kalori_target).toBe(harapan.kalori_target);
    expect(Number(target[0]?.protein_target_g)).toBe(harapan.protein_target_g);
    expect(Number(target[0]?.zat_besi_target_mg)).toBe(18); // perempuan

    const tampil = await (await profileGet()).json();
    expect(tampil.nutrition_target).toMatchObject({
      id: target[0]?.id,
      kalori_target: harapan.kalori_target,
      protein_target_g: harapan.protein_target_g,
    });
  });

  it("PATCH tanpa data fisik (hanya nama) tidak menambah baris target", async () => {
    const user = await penggunaTerdaftar();

    const res = await profilePatch(patch("/api/profile", { nama: "Nama Baru" }));
    expect(res.status).toBe(200);
    expect((await res.json()).nutrition_target).toBeNull();
    expect(await prisma.nutritionTarget.count({ where: { user_id: user.id } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).nama).toBe("Nama Baru");
  });

  it("PATCH tidak valid 400 (rentang, kolom tak dikenal) dan tidak mengubah apa pun", async () => {
    const user = await penggunaTerdaftar();

    const a = await profilePatch(patch("/api/profile", { berat_badan_kg: 5 }));
    const b = await profilePatch(patch("/api/profile", { email: "ganti@kobi-uji.test" }));
    expect(a.status).toBe(400);
    expect(b.status).toBe(400);
    expect(await prisma.nutritionTarget.count()).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(user.email);
  });

  // Catatan risiko laten (bukan galat yang terlihat): dua PATCH data fisik di
  // hari yang sama menghasilkan dua baris dengan `berlaku_sejak` sama, dan GET
  // memakai `findFirst orderBy berlaku_sejak desc` tanpa penentu seri. Standar SQL
  // tidak menjamin baris mana yang kembali; pada Postgres 16 dengan indeks
  // (user_id, berlaku_sejak) yang terbaca adalah baris terbaru, jadi tes ini lulus.
  // Bila suatu saat gagal, tambahkan `dibuat_pada`/id sebagai urutan kedua.
  it("dua PATCH data fisik di hari yang sama, GET /api/profile memuat target terbaru", async () => {
    await penggunaTerdaftar();

    await profilePatch(patch("/api/profile", { berat_badan_kg: 50, tinggi_badan_cm: 160 }));
    await profilePatch(patch("/api/profile", { berat_badan_kg: 100, tinggi_badan_cm: 160 }));

    const terbaru = hitungTargetGizi({ berat_badan_kg: 100, tinggi_badan_cm: 160 });
    const tampil = await (await profileGet()).json();
    expect(tampil.nutrition_target.kalori_target).toBe(terbaru.kalori_target);
  });
});

describe("jadwal kuliah", () => {
  it("401 tanpa sesi", async () => {
    expect((await schedulesGet()).status).toBe(401);
    expect((await schedulesPost(post("/api/schedules", {}))).status).toBe(401);
  });

  it("POST lalu GET: jam tersimpan benar (kolom TIME) dan urut menurut hari lalu jam", async () => {
    const user = await buatUser();
    masukSebagai(user.id);

    const buat = (mata_kuliah: string, hari: number, jam_mulai: string, jam_selesai: string) =>
      schedulesPost(
        post("/api/schedules", { mata_kuliah, hari, jam_mulai, jam_selesai, lokasi_ruang: "Gedung A" }),
      );

    const r1 = await buat("Kalkulus", 2, "07:30", "09:10");
    expect(r1.status).toBe(201);
    expect((await r1.json()).schedule).toMatchObject({ jam_mulai: "07:30", jam_selesai: "09:10" });

    expect((await buat("Fisika", 1, "13:00", "14:40")).status).toBe(201);
    expect((await buat("Basis Data", 2, "00:05", "23:59")).status).toBe(201);

    const res = await schedulesGet();
    expect(res.status).toBe(200);
    const { schedules } = await res.json();
    expect(schedules.map((s: { mata_kuliah: string }) => s.mata_kuliah)).toEqual([
      "Fisika",
      "Basis Data",
      "Kalkulus",
    ]);
    expect(schedules[2]).toMatchObject({
      hari: 2,
      jam_mulai: "07:30",
      jam_selesai: "09:10",
      lokasi_ruang: "Gedung A",
    });

    // Nilai yang benar-benar ada di Postgres adalah jam dinding apa adanya,
    // tidak bergeser oleh zona waktu proses.
    const mentah = await prisma.$queryRaw<{ jam_mulai: string; jam_selesai: string }[]>`
      SELECT jam_mulai::text AS jam_mulai, jam_selesai::text AS jam_selesai
      FROM class_schedules WHERE mata_kuliah = 'Kalkulus'`;
    expect(mentah[0]).toEqual({ jam_mulai: "07:30:00", jam_selesai: "09:10:00" });
  });

  it("GET hanya memuat jadwal milik pengguna sendiri", async () => {
    const a = await buatUser("A");
    const b = await buatUser("B");

    masukSebagai(a.id);
    await schedulesPost(post("/api/schedules", { mata_kuliah: "Milik A", hari: 1, jam_mulai: "08:00", jam_selesai: "09:00" }));
    masukSebagai(b.id);
    await schedulesPost(post("/api/schedules", { mata_kuliah: "Milik B", hari: 1, jam_mulai: "08:00", jam_selesai: "09:00" }));

    const { schedules } = await (await schedulesGet()).json();
    expect(schedules.map((s: { mata_kuliah: string }) => s.mata_kuliah)).toEqual(["Milik B"]);
  });

  it("400 untuk jam mulai >= jam selesai, tidak ada baris tersimpan", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    const res = await schedulesPost(
      post("/api/schedules", { mata_kuliah: "X", hari: 1, jam_mulai: "10:00", jam_selesai: "09:00" }),
    );
    expect(res.status).toBe(400);
    expect(await prisma.classSchedule.count()).toBe(0);
  });

  it("DELETE milik sendiri 204; milik orang lain ditolak dan baris tetap ada", async () => {
    const a = await buatUser("A");
    const b = await buatUser("B");
    const jadwal = await prisma.classSchedule.create({
      data: {
        user_id: a.id,
        mata_kuliah: "Milik A",
        hari: 3,
        jam_mulai: new Date("1970-01-01T08:00:00.000Z"),
        jam_selesai: new Date("1970-01-01T09:00:00.000Z"),
      },
    });

    masukSebagai(b.id);
    const ditolak = await scheduleDelete(buatRequest("DELETE", `/api/schedules/${jadwal.id}`), paramsId(jadwal.id));
    expect(ditolak.status).toBe(403);
    expect(await prisma.classSchedule.count()).toBe(1);

    masukSebagai(a.id);
    const ok = await scheduleDelete(buatRequest("DELETE", `/api/schedules/${jadwal.id}`), paramsId(jadwal.id));
    expect(ok.status).toBe(204);
    expect(await prisma.classSchedule.count()).toBe(0);
  });

  // Regresi (sebelumnya bug): DELETE /api/schedules/{id} dengan id yang bukan uuid tidak divalidasi.
  // `findUnique` pada kolom UUID melempar galat Prisma (P2023) yang tidak
  // ditangkap (route ini tidak dibungkus `denganPenangananGalat`), sehingga
  // handler melempar dan klien menerima 500 mentah. Seharusnya 404 NOT_FOUND
  // (seperti /api/meals/[id]/estimate yang memakai `mealIdSchema`).
  it("regresi: DELETE dengan id bukan uuid seharusnya 404, bukan melempar galat", async () => {
    const user = await buatUser();
    masukSebagai(user.id);
    const res = await scheduleDelete(buatRequest("DELETE", "/api/schedules/bukan-uuid"), paramsId("bukan-uuid"));
    expect(res.status).toBe(404);
  });
});
