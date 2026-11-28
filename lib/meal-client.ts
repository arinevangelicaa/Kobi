import type { ItemMakanan } from "@/lib/azure/openai";
import type { CatatanMakanDto } from "@/lib/services/meal";

type HasilAnalisis = { meal: CatatanMakanDto; items: ItemMakanan[] };

async function postMeal(url: string, init?: RequestInit): Promise<HasilAnalisis> {
  const respons = await fetch(url, { ...init, method: "POST" }).catch(() => {
    throw new Error("Koneksi terputus. Periksa riwayat sebelum mengirim ulang catatan.");
  });
  const data = await respons.json().catch(() => null);

  if (respons.status === 401 || respons.redirected) {
    throw new Error("Sesi kamu berakhir. Masuk kembali untuk melanjutkan.");
  }
  if (!respons.ok) {
    throw new Error(data?.error?.message ?? "Catatan tidak dapat diproses.");
  }
  if (!data?.success || !data.meal || !Array.isArray(data.items)) {
    throw new Error("Respons tidak lengkap. Periksa riwayat sebelum mengirim ulang catatan.");
  }
  return data;
}

export function simpanCatatanMakan(teks_input: string) {
  return postMeal("/api/meals", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teks_input }),
  });
}

export function ulangiEstimasiMakan(id: string) {
  return postMeal(`/api/meals/${encodeURIComponent(id)}/estimate`);
}
