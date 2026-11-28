import type { ProfileUpdateInput } from "@/lib/validation/profile";
import type { ScheduleCreateInput } from "@/lib/validation/schedule";

export type ProfilUser = {
  nama: string;
  email: string;
  tanggal_lahir: string | null;
  jenis_kelamin: ProfileUpdateInput["jenis_kelamin"];
  berat_badan_kg: number | null;
  tinggi_badan_cm: number | null;
  preferensi_anggaran: number | null;
};

export type DataProfil = {
  user: ProfilUser;
  nutrition_target: {
    protein_target_g: number;
    karbohidrat_target_g: number;
    lemak_target_g: number;
  } | null;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init).catch((error: unknown) => {
    if (init?.signal?.aborted) throw error;
    throw new Error("Koneksi terputus. Coba lagi.");
  });
  if (response.status === 401 || response.redirected) {
    throw new Error("Sesi berakhir. Silakan masuk kembali.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error(data?.error?.message ?? "Permintaan tidak dapat diproses. Coba lagi.");
  }
  return data;
}

export function muatProfil(signal: AbortSignal) {
  return request<DataProfil>("/api/profile", { signal, cache: "no-store" });
}

export function simpanProfil(data: ProfileUpdateInput) {
  return request<DataProfil>("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function tambahJadwal(data: ScheduleCreateInput) {
  return request<{ success: true }>("/api/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
