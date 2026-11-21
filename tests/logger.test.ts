import { describe, expect, it } from "vitest";

import {
  apakahKunciSensitif,
  buatLogger,
  buatRequestId,
  denganRequestId,
  formatEntri,
  NILAI_REDAKSI,
  redaksi,
  requestIdDariRequest,
  requestIdSaatIni,
  type LevelLog,
} from "@/lib/logger";

function tangkap() {
  const baris: { level: LevelLog; teks: string }[] = [];
  const log = buatLogger((level, teks) => baris.push({ level, teks }));
  return { baris, log };
}

describe("buatRequestId", () => {
  it("menghasilkan UUID unik", () => {
    const a = buatRequestId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(buatRequestId()).not.toBe(a);
  });
});

describe("requestIdDariRequest", () => {
  const req = (nilai: string | null) => ({ headers: { get: () => nilai } });

  it("memakai x-request-id yang aman", () => {
    expect(requestIdDariRequest(req("abc-12345678"))).toBe("abc-12345678");
  });

  it("membuat yang baru bila header kosong atau tidak aman", () => {
    expect(requestIdDariRequest(req(null))).toMatch(/^[0-9a-f-]{36}$/);
    const palsu = 'x"\n{"level":"error"}';
    expect(requestIdDariRequest(req(palsu))).not.toBe(palsu);
    expect(requestIdDariRequest()).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("denganRequestId", () => {
  it("membawa request_id ke log, termasuk lewat await", async () => {
    const { baris, log } = tangkap();
    await denganRequestId("req-12345678", async () => {
      await Promise.resolve();
      expect(requestIdSaatIni()).toBe("req-12345678");
      log.info("di dalam");
    });
    expect(requestIdSaatIni()).toBeUndefined();
    expect(JSON.parse(baris[0].teks).request_id).toBe("req-12345678");
  });

  it("memisahkan konteks antar permintaan yang berjalan bersamaan", async () => {
    const { baris, log } = tangkap();
    await Promise.all(
      ["req-aaaaaaaa", "req-bbbbbbbb"].map((id) =>
        denganRequestId(id, async () => {
          await new Promise((r) => setTimeout(r, 1));
          log.info("halo");
        }),
      ),
    );
    const ids = baris.map((b) => JSON.parse(b.teks).request_id).sort();
    expect(ids).toEqual(["req-aaaaaaaa", "req-bbbbbbbb"]);
  });
});

describe("format entri", () => {
  it("satu baris JSON dengan level, pesan, waktu, request_id, dan konteks", () => {
    const { baris, log } = tangkap();
    denganRequestId("req-12345678", () => log.warn("peringatan", { rute: "/api/x", status: 503 }));

    expect(baris).toHaveLength(1);
    expect(baris[0].level).toBe("warn");
    expect(baris[0].teks).not.toContain("\n");

    const entri = JSON.parse(baris[0].teks);
    expect(entri).toMatchObject({
      level: "warn",
      pesan: "peringatan",
      request_id: "req-12345678",
      rute: "/api/x",
      status: 503,
    });
    expect(new Date(entri.waktu).toISOString()).toBe(entri.waktu);
  });

  it("tanpa request_id bila di luar permintaan", () => {
    const entri = JSON.parse(formatEntri("info", "halo"));
    expect(entri).not.toHaveProperty("request_id");
  });

  it("konteks tidak dapat menimpa kunci inti", () => {
    const entri = JSON.parse(
      formatEntri("info", "asli", { level: "error", pesan: "palsu", waktu: "x", request_id: "y" }, "id-asli-123"),
    );
    expect(entri).toMatchObject({ level: "info", pesan: "asli", request_id: "id-asli-123" });
    expect(entri.waktu).not.toBe("x");
  });

  it("baris baru dalam pesan tetap satu baris JSON", () => {
    const teks = formatEntri("info", "a\nb");
    expect(teks).not.toContain("\n");
    expect(JSON.parse(teks).pesan).toBe("a\nb");
  });

  it("menyerialkan Error beserta cause", () => {
    const sebab = Object.assign(new Error("soket putus"), { code: "ECONNRESET" });
    const entri = JSON.parse(formatEntri("error", "gagal", { galat: new Error("luar", { cause: sebab }) }));
    expect(entri.galat.name).toBe("Error");
    expect(entri.galat.message).toBe("luar");
    expect(entri.galat.cause).toMatchObject({ message: "soket putus", code: "ECONNRESET" });
  });

  it("tidak melempar untuk objek siklis maupun BigInt", () => {
    const a: Record<string, unknown> = { n: BigInt(1) };
    a.diri = a;
    const entri = JSON.parse(formatEntri("info", "x", { a }));
    expect(entri.a.n).toBe("1");
    expect(entri.a.diri).toBe("[SIKLIS]");
  });
});

describe("redaksi", () => {
  it.each([
    "password",
    "password_hash",
    "passwordHash",
    "cookie",
    "Cookie",
    "set-cookie",
    "authorization",
    "Authorization",
    "teks_input",
    "AUTH_SECRET",
    "AZURE_OPENAI_API_KEY",
    "AZURE_STORAGE_CONNECTION_STRING",
    "DATABASE_URL",
  ])("menandai %s sebagai sensitif", (kunci) => {
    expect(apakahKunciSensitif(kunci)).toBe(true);
  });

  it.each(["pesan", "user_id", "max_tokens", "status", "request_id", "jarak_meter"])(
    "tidak menandai %s",
    (kunci) => {
      expect(apakahKunciSensitif(kunci)).toBe(false);
    },
  );

  it("mengganti nilai kunci sensitif di tingkat mana pun", () => {
    const hasil = redaksi({
      user_id: "u1",
      password: "rahasia123",
      data: { teks_input: "nasi goreng dua piring dan es teh", password_hash: "$argon2id$abc" },
      headers: { cookie: "authjs.session-token=zzz", authorization: "Bearer abc", accept: "*/*" },
      env: { AUTH_SECRET: "s3cr3t" },
      daftar: [{ password: "x" }],
    });

    expect(hasil).toEqual({
      user_id: "u1",
      password: NILAI_REDAKSI,
      data: { teks_input: NILAI_REDAKSI, password_hash: NILAI_REDAKSI },
      headers: { cookie: NILAI_REDAKSI, authorization: NILAI_REDAKSI, accept: "*/*" },
      env: { AUTH_SECRET: NILAI_REDAKSI },
      daftar: [{ password: NILAI_REDAKSI }],
    });
  });

  it("tidak mengubah objek asli", () => {
    const asli = { password: "x" };
    redaksi(asli);
    expect(asli.password).toBe("x");
  });

  it("menyamarkan kredensial di dalam URL koneksi pada string dan pesan galat", () => {
    const url = "postgresql://kobi:sangat-rahasia@host:5432/kobi";
    const hasil = JSON.stringify(redaksi({ info: `gagal ke ${url}`, galat: new Error(`connect ${url}`) }));
    expect(hasil).not.toContain("sangat-rahasia");
    expect(hasil).toContain("postgresql://[REDAKSI]@host");
  });
});

describe("logger tidak pernah membocorkan data sensitif", () => {
  it("baris akhir tidak memuat password, cookie, authorization, teks_input, atau AUTH_SECRET", () => {
    const { baris, log } = tangkap();
    log.error("gagal", {
      galat: new Error("boom"),
      body: { email: "a@b.id", password: "PASSWORD-RAHASIA", teks_input: "TEKS-UTUH-PENGGUNA" },
      headers: { cookie: "COOKIE-SESI", authorization: "Bearer TOKEN-RAHASIA" },
      env: { AUTH_SECRET: "SECRET-AUTH" },
      password_hash: "HASH-ARGON",
    });

    const teks = baris[0].teks;
    for (const rahasia of [
      "PASSWORD-RAHASIA",
      "TEKS-UTUH-PENGGUNA",
      "COOKIE-SESI",
      "TOKEN-RAHASIA",
      "SECRET-AUTH",
      "HASH-ARGON",
    ]) {
      expect(teks).not.toContain(rahasia);
    }
    expect(JSON.parse(teks).body.email).toBe("a@b.id");
  });
});
