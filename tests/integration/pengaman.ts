/**
 * Pengaman tes integrasi: menolak DATABASE_URL yang bukan basis data uji lokal.
 *
 * Tes membersihkan tabel (TRUNCATE) dan tidak boleh sampai menyentuh basis data
 * pengembang atau Azure. Dipisah dari setup.ts supaya bisa dites unit
 * (tests/pengaman-integrasi.test.ts) tanpa basis data.
 */

const HOST_LOKAL = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

// `pg-connection-string` menyalin SEMUA parameter query ke konfigurasi koneksi,
// jadi `?host=...`, `?db=...`, `?user=...` menimpa bagian URL yang sudah dicek
// di bawah dan TRUNCATE bisa terkirim ke server lain. Hanya parameter yang
// tidak mengubah tujuan koneksi yang diizinkan.
const PARAMETER_DIIZINKAN = new Set(["sslmode", "schema", "application_name", "connect_timeout"]);

// Nama harus persis "test" atau berakhiran _test / -test ("kobi_test").
// `/test/i` polos juga cocok dengan "latest" dan "contest".
const POLA_NAMA_DB_UJI = /(^|[_-])test$/i;

export function pastikanBasisDataUji(url: string | undefined): void {
  if (!url) {
    throw new Error(
      "DATABASE_URL belum diset. Jalankan lewat scripts/test-integration.sh (Docker) " +
        "atau set DATABASE_URL ke basis data uji lokal, mis. " +
        "postgresql://kobi:kobi_test@127.0.0.1:54329/kobi_test.",
    );
  }

  let alamat: URL;
  try {
    alamat = new URL(url);
  } catch {
    throw new Error("DATABASE_URL tidak dapat dibaca sebagai URL.");
  }

  for (const nama of alamat.searchParams.keys()) {
    if (!PARAMETER_DIIZINKAN.has(nama.toLowerCase())) {
      throw new Error(
        `Tes integrasi menolak DATABASE_URL dengan parameter query "${nama}": parameter itu dapat ` +
          "menimpa host atau basis data tujuan. Yang diizinkan: " +
          `${[...PARAMETER_DIIZINKAN].join(", ")}.`,
      );
    }
  }

  const namaDb = decodeURIComponent(alamat.pathname.replace(/^\//, ""));
  if (!HOST_LOKAL.has(alamat.hostname) || !POLA_NAMA_DB_UJI.test(namaDb)) {
    throw new Error(
      `Tes integrasi menolak DATABASE_URL ini (host "${alamat.hostname}", basis data "${namaDb}"): ` +
        "hanya host lokal dengan nama basis data 'test' atau berakhiran _test/-test yang diizinkan, " +
        "karena tes mengosongkan tabel.",
    );
  }
}
