/**
 * Util bersama untuk kolom Postgres @db.Time(6): `vendors.jam_buka`/`jam_tutup`
 * dan `class_schedules.jam_mulai`/`jam_selesai`.
 *
 * Driver `pg` menaruh nilai TIME literal di slot UTC saat dibaca kembali
 * sebagai Date JavaScript (dibuktikan lewat query langsung ke Postgres --
 * lihat issue #39 dan #44). Nilai ini merepresentasikan jam dinding WIB
 * (lihat docs/architecture.md), BUKAN jam UTC sungguhan -- "UTC" di sini
 * cuma konvensi penyimpanan yang dipilih supaya nilainya TIDAK bergantung
 * timezone proses Node yang menjalankan kode.
 *
 * SELALU baca/tulis kolom TIME lewat kedua fungsi ini. JANGAN pernah pakai
 * `new Date(y, m, d, h, m)` atau `Date.getHours()`/`getMinutes()` langsung
 * pada kolom ini -- itu memakai jam lokal proses, yang bisa WIB di mesin
 * pengembang tapi UTC di Azure App Service/GitHub Actions, membuat nilai
 * yang benar-benar tersimpan di database berbeda untuk input yang sama
 * tergantung TZ server yang kebetulan memprosesnya (lihat issue #44).
 */

/** Mengonversi string "HH:MM" menjadi Date yang siap ditulis ke kolom @db.Time(6). */
export function jamStrKeDate(jamStr: string): Date {
  const [jam, menit] = jamStr.split(":");
  const h = (jam ?? "00").padStart(2, "0");
  const m = (menit ?? "00").padStart(2, "0");
  return new Date(`1970-01-01T${h}:${m}:00.000Z`);
}

/** Mengonversi Date hasil baca kolom @db.Time(6) kembali menjadi string "HH:MM". */
export function dateKeJamStr(d: Date | null | undefined): string | null {
  if (!d) return null;
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}
