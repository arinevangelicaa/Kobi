/**
 * F2 - Integrasi Azure OpenAI untuk estimasi gizi dari teks bebas.
 *
 * Lihat docs/architecture.md bagian 9.1 dan 8.2. Dipanggil dari
 * lib/services/nutrition-estimate.ts, yang nanti dipasang ke POST
 * /api/meals begitu F1 (issue #9) selesai.
 *
 * Desain sama dengan lib/azure/maps.ts: kegagalan apa pun (kunci belum
 * diset, API error, timeout, JSON tidak sesuai skema) mengembalikan null,
 * TIDAK throw. Pemanggil menyimpan catatan makan TANPA estimasi dan
 * menandainya untuk diproses ulang -- sesuai docs bagian 15, bukan
 * mengarang angka tebakan.
 */

const CHAT_COMPLETIONS_PATH = "/chat/completions";
/**
 * Versi API Azure OpenAI yang mendukung Structured Outputs (response_format
 * json_schema dengan strict: true). Belum bisa diverifikasi lewat panggilan
 * sungguhan di lingkungan ini karena AZURE_OPENAI_API_KEY belum
 * diprovisioning (issue #33) -- lihat README pengujian di bawah modul ini.
 */
const API_VERSION = "2024-10-21";

/**
 * Penanda revisi prompt. Naikkan setiap kali SYSTEM_PROMPT berubah makna,
 * supaya model_versi yang disimpan di nutrition_estimates tetap bisa
 * ditelusuri ke prompt yang menghasilkannya (docs bagian 9.1).
 */
const PROMPT_VERSION = "prompt-v1-2026-10-09";

const SYSTEM_PROMPT = `Kamu adalah ahli gizi yang memperkirakan kandungan gizi makanan Indonesia, termasuk makanan warung, kaki lima, dan pasar tanpa label gizi resmi.

Aturan:
- Input berupa bahasa sehari-hari, kerap tanpa takaran. Perkirakan porsi lazim mahasiswa Indonesia bila takaran tidak disebutkan.
- Kenali penamaan lokal seperti "nasi kucing", "gudeg", "es teh tawar", "indomie telur", dan sejenisnya.
- Bila makanan tidak dikenali atau deskripsinya terlalu samar, tetap berikan estimasi kasar tapi kembalikan tingkat_keyakinan rendah (di bawah 0.4). Jangan mengarang angka presisi tanpa dasar.
- Balas HANYA JSON sesuai skema yang diberikan, tanpa teks penjelasan tambahan.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "items",
    "kalori_estimasi",
    "protein_g",
    "karbohidrat_g",
    "lemak_g",
    "zat_besi_mg",
    "estimasi_harga",
    "tingkat_keyakinan",
  ],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nama", "porsi"],
        properties: {
          nama: { type: "string" },
          porsi: { type: "string" },
        },
      },
    },
    kalori_estimasi: { type: "integer" },
    protein_g: { type: "number" },
    karbohidrat_g: { type: "number" },
    lemak_g: { type: "number" },
    zat_besi_mg: { type: "number" },
    estimasi_harga: { type: "integer" },
    tingkat_keyakinan: { type: "number" },
  },
} as const;

export interface ItemMakanan {
  nama: string;
  porsi: string;
}

/** Bentuk mentah balasan model, persis skema docs/architecture.md bagian 9.1. */
export interface EstimasiGiziMentah {
  items: ItemMakanan[];
  kalori_estimasi: number;
  protein_g: number;
  karbohidrat_g: number;
  lemak_g: number;
  zat_besi_mg: number;
  estimasi_harga: number;
  tingkat_keyakinan: number;
}

function validasiBentukRespons(data: unknown): data is EstimasiGiziMentah {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;

  const angkaWajib: (keyof EstimasiGiziMentah)[] = [
    "kalori_estimasi",
    "protein_g",
    "karbohidrat_g",
    "lemak_g",
    "zat_besi_mg",
    "estimasi_harga",
    "tingkat_keyakinan",
  ];
  if (!angkaWajib.every((k) => typeof d[k] === "number" && Number.isFinite(d[k]))) {
    return false;
  }

  if (!Array.isArray(d.items)) return false;
  return d.items.every(
    (it) =>
      typeof it === "object" &&
      it !== null &&
      typeof (it as Record<string, unknown>).nama === "string" &&
      typeof (it as Record<string, unknown>).porsi === "string",
  );
}

/**
 * Nama deployment ditambah revisi prompt, dipakai sebagai model_versi
 * saat menyimpan ke nutrition_estimates.
 */
export function namaModelVersi(): string {
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "azure-openai";
  return `${deployment}@${PROMPT_VERSION}`;
}

/**
 * Meminta Azure OpenAI memperkirakan kandungan gizi dari teks bebas.
 * Mengembalikan null (bukan throw) bila kunci belum diset, API gagal,
 * timeout 10 detik terlampaui, atau balasan tidak sesuai skema.
 */
export async function estimasiGiziDariTeks(teksInput: string): Promise<EstimasiGiziMentah | null> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!endpoint || !apiKey || !deployment) {
    // Belum diprovisioning (issue #33). Keadaan yang diharapkan sampai
    // resource Azure OpenAI sungguhan dibuat, bukan kegagalan jaringan.
    return null;
  }

  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}${CHAT_COMPLETIONS_PATH}?api-version=${API_VERSION}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: teksInput },
        ],
        temperature: 0.2,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "estimasi_gizi",
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
      }),
      // Target respons di bawah 5 detik untuk keperluan demo (docs bagian
      // 13), tapi beri margin sebelum menyerah ke fallback "tanpa estimasi".
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`Azure OpenAI mengembalikan status ${response.status}`);
      return null;
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const konten = body.choices?.[0]?.message?.content;
    if (!konten) {
      console.warn("Azure OpenAI tidak mengembalikan konten pesan.");
      return null;
    }

    const parsed: unknown = JSON.parse(konten);
    if (!validasiBentukRespons(parsed)) {
      console.warn("Balasan Azure OpenAI tidak sesuai skema estimasi gizi.");
      return null;
    }

    return parsed;
  } catch (error) {
    // Timeout, galat jaringan, atau JSON.parse gagal. Tidak dilempar ulang
    // -- pemanggil menyimpan catatan makan tanpa estimasi.
    console.warn("Azure OpenAI gagal dipanggil:", error);
    return null;
  }
}
