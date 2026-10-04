/**
 * F4 - Integrasi Azure Maps: jarak dan waktu tempuh sungguhan ke vendor.
 *
 * Lihat docs/architecture.md bagian 5.3, 11 langkah 3, dan 13. Dipanggil dari
 * app/api/recommendations/route.ts setelah kandidat vendor disaring jam buka
 * (bagian 11 langkah 1-2), hasilnya dioper ke lib/services/recommendation.ts
 * lewat KriteriaRekomendasi.jarakAktual.
 *
 * Desain penting:
 * - Satu kali panggilan Matrix Routing per permintaan (1 asal x N tujuan),
 *   bukan N panggilan terpisah -- menekan kuota/biaya.
 * - Hasil per pasangan (lokasi pengguna dibulatkan, vendor) di-cache di
 *   memori beberapa menit (docs bagian 13), supaya permintaan berikutnya
 *   dari lokasi yang kurang lebih sama tidak memanggil Azure Maps lagi.
 * - Kegagalan apa pun (kunci belum diset, API error, timeout) membuat fungsi
 *   mengembalikan hasil parsial atau Map kosong, TIDAK throw. Pemanggil
 *   (route.ts) jatuh kembali ke estimasi Haversine per vendor yang tidak ada
 *   di hasil -- sesuai docs bagian 15 ("Rekomendasi tetap tampil memakai
 *   jarak garis lurus, ditandai sebagai perkiraan kasar").
 */

export interface Koordinat {
  latitude: number;
  longitude: number;
}

export interface JarakWaktuTempuh {
  jarakMeter: number;
  waktuTempuhMenit: number;
}

const AZURE_MAPS_MATRIX_URL = "https://atlas.microsoft.com/route/matrix/sync/json";
const AZURE_MAPS_API_VERSION = "1.0";

/**
 * Moda yang dipakai Azure Maps untuk estimasi waktu tempuh. "motorcycle"
 * dipilih karena mayoritas mahasiswa di sekitar kampus bepergian naik motor
 * untuk jarak pendek ke warung, konsisten dengan kecepatan default 15 km/jam
 * di lib/services/recommendation.ts (terlalu cepat untuk jalan kaki, terlalu
 * lambat untuk mobil di jalan sepi sekitar kampus).
 */
const TRAVEL_MODE = "motorcycle";

/** Hasil di-cache 5 menit, sesuai docs bagian 13 ("beberapa menit"). */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Pembulatan lokasi pengguna ke ~111 m (3 desimal derajat) untuk kunci cache. */
const PRESISI_CACHE_DESIMAL = 3;

interface EntriCache {
  nilai: JarakWaktuTempuh;
  kedaluwarsaPada: number;
}

// Cache modul-level: bertahan selama proses server hidup (Next.js menjaga
// modul tetap di memori antar permintaan dalam satu proses/instance).
const cache = new Map<string, EntriCache>();

function kunciCache(origin: Koordinat, vendorId: string): string {
  const lat = origin.latitude.toFixed(PRESISI_CACHE_DESIMAL);
  const lon = origin.longitude.toFixed(PRESISI_CACHE_DESIMAL);
  return `${lat},${lon}|${vendorId}`;
}

function ambilDariCache(origin: Koordinat, vendorId: string): JarakWaktuTempuh | undefined {
  const entri = cache.get(kunciCache(origin, vendorId));
  if (!entri) return undefined;
  if (entri.kedaluwarsaPada < Date.now()) {
    cache.delete(kunciCache(origin, vendorId));
    return undefined;
  }
  return entri.nilai;
}

function simpanKeCache(origin: Koordinat, vendorId: string, nilai: JarakWaktuTempuh): void {
  cache.set(kunciCache(origin, vendorId), {
    nilai,
    kedaluwarsaPada: Date.now() + CACHE_TTL_MS,
  });
}

interface AzureMatrixResponseCell {
  statusCode: number;
  response?: {
    routeSummary?: {
      lengthInMeters?: number;
      travelTimeInSeconds?: number;
    };
  };
}

interface AzureMatrixResponse {
  matrix?: AzureMatrixResponseCell[][];
}

/**
 * Menghitung jarak dan waktu tempuh dari satu lokasi pengguna ke banyak
 * vendor sekaligus lewat Azure Maps Matrix Routing API.
 *
 * Mengembalikan Map dari vendor_id ke hasil. Vendor yang gagal dihitung
 * (termasuk seluruhnya, bila AZURE_MAPS_KEY belum diset atau API down)
 * tidak ada di dalam Map -- bukan error, supaya pemanggil bisa jatuh
 * kembali ke estimasi Haversine per vendor.
 */
export async function hitungJarakWaktuBanyakTujuan(
  origin: Koordinat,
  tujuan: readonly (Koordinat & { id: string })[],
): Promise<Map<string, JarakWaktuTempuh>> {
  const hasil = new Map<string, JarakWaktuTempuh>();
  if (tujuan.length === 0) return hasil;

  const belumAdaDiCache: (Koordinat & { id: string })[] = [];
  for (const t of tujuan) {
    const dariCache = ambilDariCache(origin, t.id);
    if (dariCache) {
      hasil.set(t.id, dariCache);
    } else {
      belumAdaDiCache.push(t);
    }
  }

  if (belumAdaDiCache.length === 0) return hasil;

  const apiKey = process.env.AZURE_MAPS_KEY;
  if (!apiKey) {
    // Belum diprovisioning (lihat issue #33). Bukan kegagalan jaringan,
    // jadi tidak perlu log error -- ini keadaan yang diharapkan sampai
    // resource Azure Maps sungguhan dibuat.
    return hasil;
  }

  try {
    const url = `${AZURE_MAPS_MATRIX_URL}?api-version=${AZURE_MAPS_API_VERSION}&subscription-key=${apiKey}&travelMode=${TRAVEL_MODE}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origins: {
          type: "MultiPoint",
          coordinates: [[origin.longitude, origin.latitude]],
        },
        destinations: {
          type: "MultiPoint",
          coordinates: belumAdaDiCache.map((t) => [t.longitude, t.latitude]),
        },
      }),
      // Satu permintaan rekomendasi tidak boleh menunggu Azure Maps terlalu
      // lama; lebih baik jatuh ke estimasi Haversine daripada bikin pengguna
      // menunggu. Lihat docs bagian 5.3 (timeout layanan AI/lokasi).
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn(`Azure Maps Matrix API mengembalikan status ${response.status}`);
      return hasil;
    }

    const data = (await response.json()) as AzureMatrixResponse;
    const baris = data.matrix?.[0] ?? [];

    baris.forEach((sel, i) => {
      const tujuanKe = belumAdaDiCache[i];
      if (!tujuanKe) return;

      if (sel.statusCode !== 200 || !sel.response?.routeSummary) return;

      const { lengthInMeters, travelTimeInSeconds } = sel.response.routeSummary;
      if (lengthInMeters == null || travelTimeInSeconds == null) return;

      const nilai: JarakWaktuTempuh = {
        jarakMeter: Math.round(lengthInMeters),
        waktuTempuhMenit: Math.ceil(travelTimeInSeconds / 60),
      };

      hasil.set(tujuanKe.id, nilai);
      simpanKeCache(origin, tujuanKe.id, nilai);
    });
  } catch (error) {
    // Timeout, galat jaringan, atau respons tidak terduga. Tidak dilempar
    // ulang -- pemanggil jatuh ke estimasi Haversine untuk vendor yang
    // belum sempat dihitung.
    console.warn("Azure Maps Matrix API gagal dipanggil:", error);
  }

  return hasil;
}

/**
 * Mengosongkan cache in-memory. Hanya untuk test (tests/azure-maps.test.ts) --
 * supaya satu kasus uji tidak terpengaruh entri cache dari kasus uji lain.
 */
export function _resetCacheUntukTest(): void {
  cache.clear();
}
