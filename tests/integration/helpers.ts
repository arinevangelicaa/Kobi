/**
 * Helper tes integrasi: klien DB, pembersihan tabel, pengguna uji, pembuat
 * Request, dan tiruan Azure OpenAI lewat `globalThis.fetch`.
 */

import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeEach, vi } from "vitest";

import { _resetCacheUntukTest } from "@/lib/azure/maps";
import { prisma } from "@/lib/db";
import { resetPembatasLaju } from "@/lib/rate-limit";

import { masukSebagai } from "./sesi";

export { prisma, masukSebagai };

// ---------------------------------------------------------------------------
// Isolasi
// ---------------------------------------------------------------------------

/** Mengosongkan semua tabel aplikasi (kecuali riwayat migrasi Prisma). */
export async function kosongkanDb() {
  const baris = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (baris.length === 0) return;

  const daftar = baris.map((b) => `"public"."${b.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${daftar} RESTART IDENTITY CASCADE`);
}

/**
 * Dipanggil sekali di tingkat atas berkas tes. Sebelum tiap tes: tabel kosong,
 * pembatas laju dan cache Azure Maps di memori direset, tidak ada sesi login.
 * Sesudahnya: `fetch` tiruan dilepas. Setelah berkas selesai: koneksi ditutup.
 */
export function pakaiDbBersih() {
  beforeEach(async () => {
    await kosongkanDb();
    resetPembatasLaju();
    _resetCacheUntukTest();
    masukSebagai(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
}

// ---------------------------------------------------------------------------
// Pengguna uji
// ---------------------------------------------------------------------------

/** Membuat pengguna langsung di DB dengan email unik (tanpa melewati register). */
export async function buatUser(nama = "Pengguna Uji") {
  const user = await prisma.user.create({
    data: { email: `uji-${randomUUID()}@kobi-uji.test`, nama },
  });
  return user;
}

/** Email unik per tes. */
export function emailUnik(awalan = "uji") {
  return `${awalan}-${randomUUID()}@kobi-uji.test`;
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export function buatRequest(metode: string, url: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method: metode,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

export const get = (url: string) => buatRequest("GET", url);
export const post = (url: string, body?: unknown) => buatRequest("POST", url, body ?? {});
export const patch = (url: string, body: unknown) => buatRequest("PATCH", url, body);

/** Argumen kedua Route Handler dinamis `[id]`. */
export const paramsId = (id: string) => ({ params: Promise.resolve({ id }) });

// ---------------------------------------------------------------------------
// Tiruan Azure OpenAI
// ---------------------------------------------------------------------------

export const ESTIMASI_CONTOH = {
  items: [
    { nama: "nasi putih", porsi: "1 piring" },
    { nama: "telur dadar", porsi: "1 butir" },
  ],
  kalori_estimasi: 520,
  protein_g: 20,
  karbohidrat_g: 70,
  lemak_g: 15,
  zat_besi_mg: 3,
  estimasi_harga: 15000,
  tingkat_keyakinan: 0.8,
};

export type PerilakuAzure = "berhasil" | "http500" | "timeout";

/**
 * Mengganti `globalThis.fetch`. Hanya titik akhir Azure OpenAI tiruan yang
 * dilayani; panggilan lain (mis. Azure Maps, jaringan sungguhan) membuat tes
 * gagal supaya tidak ada yang lolos diam-diam.
 */
export function pasangAzureOpenAI(awal: PerilakuAzure = "berhasil") {
  const keadaan = {
    perilaku: awal,
    estimasi: { ...ESTIMASI_CONTOH } as Record<string, unknown>,
    /** Jumlah panggilan fetch ke Azure OpenAI (termasuk retry otomatis). */
    panggilan: 0,
  };

  const fetchTiruan = vi.fn(async (masukan: unknown) => {
    const url = typeof masukan === "string" ? masukan : String((masukan as { url?: string }).url ?? masukan);
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT as string;
    if (!url.startsWith(endpoint)) {
      throw new Error(`Tes integrasi tidak boleh memanggil jaringan: ${url}`);
    }

    keadaan.panggilan++;

    if (keadaan.perilaku === "timeout") {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    }
    if (keadaan.perilaku === "http500") {
      return new Response("galat server", { status: 500 });
    }

    return new Response(
      JSON.stringify({
        choices: [
          { finish_reason: "stop", message: { content: JSON.stringify(keadaan.estimasi) } },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });

  vi.stubGlobal("fetch", fetchTiruan);

  return {
    fetchTiruan,
    atur(perilaku: PerilakuAzure) {
      keadaan.perilaku = perilaku;
    },
    aturEstimasi(ubahan: Record<string, unknown>) {
      keadaan.estimasi = { ...ESTIMASI_CONTOH, ...ubahan };
    },
    get panggilan() {
      return keadaan.panggilan;
    },
    reset() {
      keadaan.panggilan = 0;
    },
  };
}
