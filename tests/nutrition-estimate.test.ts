import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT"] as const;

describe("dapatkanEstimasiGizi", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("mengembalikan status tanpa_estimasi saat Azure OpenAI belum terprovisioning", async () => {
    const { dapatkanEstimasiGizi } = await import("@/lib/services/nutrition-estimate");

    const hasil = await dapatkanEstimasiGizi("nasi telur dan es teh");

    expect(hasil.status).toBe("tanpa_estimasi");
  });

  it("memetakan balasan model ke bentuk siap simpan, termasuk model_versi", async () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://contoh.openai.azure.com";
    process.env.AZURE_OPENAI_API_KEY = "kunci-uji";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-kobi";

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: [{ nama: "nasi putih", porsi: "1 piring" }],
                kalori_estimasi: 520.4,
                protein_g: 14.5,
                karbohidrat_g: 78,
                lemak_g: 15.2,
                zat_besi_mg: 2.1,
                estimasi_harga: 12000.9,
                tingkat_keyakinan: 0.72,
              }),
            },
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const { dapatkanEstimasiGizi } = await import("@/lib/services/nutrition-estimate");
    const hasil = await dapatkanEstimasiGizi("nasi telur dan es teh");

    if (hasil.status !== "berhasil") throw new Error("harus berhasil");
    expect(hasil.estimasi.kalori_estimasi).toBe(520); // dibulatkan
    expect(hasil.estimasi.protein_g).toBe(14.5);
    expect(hasil.estimasi.model_versi).toBe("gpt-kobi@prompt-v1-2026-10-09");
    expect(hasil.estimasi_harga).toBe(12001); // dibulatkan
    expect(hasil.items).toEqual([{ nama: "nasi putih", porsi: "1 piring" }]);
  });

  it("membatasi tingkat_keyakinan ke rentang 0..1 walau model membalas di luar rentang", async () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://contoh.openai.azure.com";
    process.env.AZURE_OPENAI_API_KEY = "kunci-uji";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-kobi";

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: [],
                kalori_estimasi: 100,
                protein_g: 1,
                karbohidrat_g: 1,
                lemak_g: 1,
                zat_besi_mg: 1,
                estimasi_harga: 1000,
                tingkat_keyakinan: 1.5, // halusinasi model, di luar rentang
              }),
            },
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const { dapatkanEstimasiGizi } = await import("@/lib/services/nutrition-estimate");
    const hasil = await dapatkanEstimasiGizi("sesuatu yang tidak jelas");

    if (hasil.status !== "berhasil") throw new Error("harus berhasil");
    expect(hasil.estimasi.tingkat_keyakinan).toBe(1);
  });
});
