import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { estimasiGiziDariTeks, namaModelVersi } from "@/lib/azure/openai";

const ENV_KEYS = ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT"] as const;

function setEnvLengkap() {
  process.env.AZURE_OPENAI_ENDPOINT = "https://contoh.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "kunci-uji";
  process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-kobi";
}

function buatResponChat(contentObj: unknown) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(contentObj) } }],
    }),
  };
}

const CONTOH_VALID = {
  items: [{ nama: "nasi putih", porsi: "1 piring" }],
  kalori_estimasi: 520,
  protein_g: 14.5,
  karbohidrat_g: 78,
  lemak_g: 15.2,
  zat_besi_mg: 2.1,
  estimasi_harga: 12000,
  tingkat_keyakinan: 0.72,
};

describe("estimasiGiziDariTeks", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("mengembalikan null tanpa memanggil fetch bila env belum lengkap", async () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://contoh.openai.azure.com";
    // sengaja tidak set API_KEY dan DEPLOYMENT
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const hasil = await estimasiGiziDariTeks("nasi telur");

    expect(hasil).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mengembalikan null (bukan throw) saat fetch gagal total", async () => {
    setEnvLengkap();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("jaringan putus")) as unknown as typeof fetch;

    const hasil = await estimasiGiziDariTeks("nasi telur");

    expect(hasil).toBeNull();
  });

  it("mengembalikan null saat status bukan 200", async () => {
    setEnvLengkap();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;

    const hasil = await estimasiGiziDariTeks("nasi telur");

    expect(hasil).toBeNull();
  });

  it("mengembalikan null saat konten pesan kosong", async () => {
    setEnvLengkap();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) }) as unknown as typeof fetch;

    const hasil = await estimasiGiziDariTeks("nasi telur");

    expect(hasil).toBeNull();
  });

  it("mengembalikan null saat konten bukan JSON valid", async () => {
    setEnvLengkap();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "bukan json{{{" } }] }),
    }) as unknown as typeof fetch;

    const hasil = await estimasiGiziDariTeks("nasi telur");

    expect(hasil).toBeNull();
  });

  it("mengembalikan null saat JSON valid tapi tidak sesuai skema (field hilang)", async () => {
    setEnvLengkap();
    const tanpaKeyakinan: Partial<typeof CONTOH_VALID> = { ...CONTOH_VALID };
    delete tanpaKeyakinan.tingkat_keyakinan;
    globalThis.fetch = vi.fn().mockResolvedValue(buatResponChat(tanpaKeyakinan)) as unknown as typeof fetch;

    const hasil = await estimasiGiziDariTeks("nasi telur");

    expect(hasil).toBeNull();
  });

  it("mem-parsing balasan valid dengan benar", async () => {
    setEnvLengkap();
    globalThis.fetch = vi.fn().mockResolvedValue(buatResponChat(CONTOH_VALID)) as unknown as typeof fetch;

    const hasil = await estimasiGiziDariTeks("nasi telur");

    expect(hasil).toEqual(CONTOH_VALID);
  });

  it("mengirim teks pengguna dan skema structured output di body permintaan", async () => {
    setEnvLengkap();
    const fetchMock = vi.fn().mockResolvedValue(buatResponChat(CONTOH_VALID));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await estimasiGiziDariTeks("nasi telur dan es teh dari warung deket kost");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("gpt-kobi");
    expect(url).toContain("chat/completions");
    const body = JSON.parse(init.body as string);
    expect(body.messages[1]).toEqual({
      role: "user",
      content: "nasi telur dan es teh dari warung deket kost",
    });
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
  });
});

describe("namaModelVersi", () => {
  afterEach(() => {
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
  });

  it("menggabungkan nama deployment dengan versi prompt", () => {
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-kobi";
    expect(namaModelVersi()).toBe("gpt-kobi@prompt-v1-2026-10-09");
  });

  it("punya fallback saat deployment belum diset", () => {
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    expect(namaModelVersi()).toContain("azure-openai@");
  });
});
