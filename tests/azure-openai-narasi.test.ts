import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  narasiCadangan,
  narasiPolaDariAgregat,
  periksaNarasi,
  type AgregatPola,
} from "@/lib/azure/openai";

function setEnvLengkap() {
  process.env.AZURE_OPENAI_ENDPOINT = "https://contoh.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "kunci-uji";
  process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-kobi";
}

const AGREGAT: AgregatPola = {
  minggu_mulai: "2026-11-16",
  minggu_selesai: "2026-11-22",
  jumlah_checkin: 9,
  rata_energi: 3.4,
  rata_fokus: 3.1,
  cukup_data: true,
  per_rentang_protein: [
    {
      kunci: "rendah",
      label: "rendah (kurang dari 10 g)",
      batas_bawah_g: 0,
      batas_atas_g: 10,
      jumlah_checkin: 3,
      rata_energi: 2.7,
      rata_fokus: 2.3,
      cukup_data: true,
    },
    {
      kunci: "sedang",
      label: "sedang (10 sampai kurang dari 20 g)",
      batas_bawah_g: 10,
      batas_atas_g: 20,
      jumlah_checkin: 4,
      rata_energi: 3.8,
      rata_fokus: 3.5,
      cukup_data: true,
    },
    {
      kunci: "tinggi",
      label: "tinggi (20 g atau lebih)",
      batas_bawah_g: 20,
      batas_atas_g: null,
      jumlah_checkin: 2,
      rata_energi: 3.5,
      rata_fokus: 3.7,
      cukup_data: true,
    },
  ],
};

const KALIMAT_BAIK = [
  "Minggu ini Anda mengisi 9 check-in dengan rata-rata energi 3,4 dan fokus 3,1.",
  "Energi paling tinggi (3,8) tercatat pada makan dengan protein sedang.",
];

function balasModel(kalimat: unknown) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ kalimat }) } }],
    }),
  };
}

describe("periksaNarasi", () => {
  it("meloloskan kalimat yang memakai angka dari agregat", () => {
    expect(periksaNarasi(KALIMAT_BAIK, AGREGAT)).toBeNull();
  });

  it("menolak lebih dari 3 kalimat atau larik kosong", () => {
    const tiga = ["Satu.", "Dua.", "Tiga."];
    expect(periksaNarasi(tiga, AGREGAT)).toBeNull();
    expect(periksaNarasi([...tiga, "Empat."], AGREGAT)).toMatch(/jumlah kalimat/);
    expect(periksaNarasi([], AGREGAT)).toMatch(/jumlah kalimat/);
  });

  it("menolak satu elemen yang berisi dua kalimat (menyelundupkan batas)", () => {
    expect(periksaNarasi(["Satu kalimat. Lalu kalimat lain."], AGREGAT)).toMatch(/lebih dari satu/);
  });

  it("tidak salah mengira desimal sebagai pemisah kalimat", () => {
    expect(periksaNarasi(["Rata-rata energi 3.4 dari 5."], AGREGAT)).toBeNull();
  });

  it("menolak istilah medis", () => {
    expect(periksaNarasi(["Pola ini mirip gejala anemia."], AGREGAT)).toMatch(/terlarang/);
    expect(periksaNarasi(["Ini bisa jadi tanda diabetes."], AGREGAT)).toMatch(/terlarang/);
  });

  it("menolak klaim sebab-akibat", () => {
    for (const k of [
      "Protein sedang membuat Anda lebih fokus.",
      "Energi naik karena Anda makan telur.",
      "Makan siang menyebabkan fokus turun.",
      "Protein tinggi meningkatkan energi.",
    ]) {
      expect(periksaNarasi([k], AGREGAT)).toMatch(/terlarang/);
    }
  });

  it("menolak saran pengobatan", () => {
    expect(periksaNarasi(["Sebaiknya minum suplemen zat besi."], AGREGAT)).toMatch(/terlarang/);
    expect(periksaNarasi(["Konsultasikan ke dokter."], AGREGAT)).toMatch(/terlarang/);
  });

  it("menolak angka yang tidak ada di agregat (halusinasi hitungan)", () => {
    expect(periksaNarasi(["Rata-rata energi Anda 4,6 minggu ini."], AGREGAT)).toMatch(/angka 4.6/);
  });

  it("menolak bukan larik dan elemen bukan string", () => {
    expect(periksaNarasi("teks biasa", AGREGAT)).toMatch(/bukan larik/);
    expect(periksaNarasi([42], AGREGAT)).toMatch(/bukan string/);
  });
});

describe("narasiCadangan", () => {
  it("lolos periksaNarasi sendiri dan paling banyak tiga kalimat", () => {
    const teks = narasiCadangan(AGREGAT);
    const kalimat = teks.match(/[^.]+\./g) ?? [];

    expect(kalimat.length).toBeLessThanOrEqual(3);
    expect(periksaNarasi(kalimat.map((k) => k.trim()), AGREGAT)).toBeNull();
  });

  it("deterministik dan menyebut rentang tertinggi", () => {
    const teks = narasiCadangan(AGREGAT);

    expect(narasiCadangan(AGREGAT)).toBe(teks);
    expect(teks).toContain("9 check-in");
    expect(teks).toContain("sedang (10 sampai kurang dari 20 g)"); // energi tertinggi 3,8
    expect(teks).toContain("tinggi (20 g atau lebih)"); // fokus tertinggi 3,7
  });

  it("tidak membandingkan bila rentang yang cukup data kurang dari dua", () => {
    const sedikit: AgregatPola = {
      ...AGREGAT,
      per_rentang_protein: AGREGAT.per_rentang_protein.map((r, i) => ({ ...r, cukup_data: i === 0 })),
    };
    expect(narasiCadangan(sedikit)).toContain("belum cukup untuk membandingkan");
  });

  it("keadaan kosong: pesan data belum cukup", () => {
    const kosong: AgregatPola = {
      ...AGREGAT,
      jumlah_checkin: 1,
      cukup_data: false,
      per_rentang_protein: [],
    };
    expect(narasiCadangan(kosong)).toMatch(/Belum cukup check-in/);
  });
});

describe("narasiPolaDariAgregat", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => setEnvLengkap());
  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("memakai kalimat model bila lolos validasi", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(balasModel(KALIMAT_BAIK)) as unknown as typeof fetch;

    const hasil = await narasiPolaDariAgregat(AGREGAT);

    expect(hasil.sumber).toBe("model");
    expect(hasil.teks).toBe(KALIMAT_BAIK.join(" "));
  });

  it("mengirim agregat di dalam penanda, memakai skema, token terbatas, dan temperature rendah", async () => {
    const fetchMock = vi.fn().mockResolvedValue(balasModel(KALIMAT_BAIK));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await narasiPolaDariAgregat(AGREGAT);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.messages[1].content).toContain("<agregat>");
    expect(body.messages[1].content).toContain('"rata_energi":3.4');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.max_tokens).toBeLessThanOrEqual(400);
    expect(body.temperature).toBeLessThanOrEqual(0.3);
  });

  it("jatuh ke template bila model melanggar batasan (sebab-akibat)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(balasModel(["Protein sedang membuat Anda lebih fokus."])) as unknown as typeof fetch;

    const hasil = await narasiPolaDariAgregat(AGREGAT);

    expect(hasil.sumber).toBe("template");
    expect(hasil.teks).toBe(narasiCadangan(AGREGAT));
  });

  it("jatuh ke template bila model membalas lebih dari tiga kalimat", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(balasModel(["Satu.", "Dua.", "Tiga.", "Empat."])) as unknown as typeof fetch;

    expect((await narasiPolaDariAgregat(AGREGAT)).sumber).toBe("template");
  });

  it("jatuh ke template bila JSON rusak, kunci tambahan, atau status galat", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ finish_reason: "stop", message: { content: "bukan json" } }] }),
    }) as unknown as typeof fetch;
    expect((await narasiPolaDariAgregat(AGREGAT)).sumber).toBe("template");

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          { finish_reason: "stop", message: { content: JSON.stringify({ kalimat: KALIMAT_BAIK, ekstra: 1 }) } },
        ],
      }),
    }) as unknown as typeof fetch;
    expect((await narasiPolaDariAgregat(AGREGAT)).sumber).toBe("template");

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 }) as unknown as typeof fetch;
    expect((await narasiPolaDariAgregat(AGREGAT)).sumber).toBe("template");
  });

  it("jatuh ke template tanpa throw saat fetch gagal total", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("jaringan putus")) as unknown as typeof fetch;

    const hasil = await narasiPolaDariAgregat(AGREGAT);

    expect(hasil.sumber).toBe("template");
  });

  it("jatuh ke template tanpa memanggil fetch bila env Azure belum diset", async () => {
    delete process.env.AZURE_OPENAI_API_KEY;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const hasil = await narasiPolaDariAgregat(AGREGAT);

    expect(hasil.sumber).toBe("template");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tidak memanggil model bila data belum cukup", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const hasil = await narasiPolaDariAgregat({ ...AGREGAT, cukup_data: false, jumlah_checkin: 1 });

    expect(hasil.sumber).toBe("template");
    expect(hasil.teks).toMatch(/Belum cukup/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
