# Tasks Left: Kobi

Sisa pekerjaan proyek, dibagi per orang. Rujukan: [docs/architecture.md](docs/architecture.md), [docs/prd.md](docs/prd.md). Nomor `#` mengarah ke GitHub Issues.

Status: **[SEKARANG]** bisa dikerjakan tanpa Azure (kode, tes dengan mock, IaC, workflow). **[BLOKIR C1]** menunggu subscription Azure (#54). **[STRETCH]** dikerjakan setelah F1-F5 dan deploy.

## Ringkasan beban

| Orang | Peran | Jumlah tugas | Isi utama |
|---|---|---|---|
| Adnan | Software, Cloud, AI Engineer | 25 (A 12, C 8, I 5) | Seluruh backend, Azure (IaC, deploy, logging), AI (prompt, narasi, evaluasi) |
| Arin | Project Manager, Software Engineer | 6 | Rute PATCH rekomendasi, halaman `/rekomendasi` dan `/profil`, dokumentasi + demo, verifikasi data warung |
| Rida | UI/UX Designer, Software Engineer | 7 | Slicing UI, layout `(app)`, halaman `/catat`, `/beranda` dan `/tren`, ikon PWA, usability testing |

Pembagian frontend: seluruh UI dikerjakan Rida dan Arin karena UI/UX sedang dikembangkan Rida. Layout `(app)` dan komponen `Disclaimer` sudah ada di `main`. Halaman `/beranda` (#51) dan `/catat` (#9, #13, sebelumnya A10 Adnan) dipindahkan ke Rida. Adnan hanya menjaga kontrak API. Backend semua endpoint sudah ada di `main`; bentuk respons ada sebagai JSDoc di berkas rutenya.

## Aturan kerja

- Commit satu baris subjek, tanpa body dan trailer, prefix `feat|fix|docs|chore|refactor|test`, sertakan nomor issue: `feat: tambah endpoint meals (#9)`.
- Jalankan `npm run db:generate` setelah clone atau ubah `prisma/schema.prisma`.
- Sebelum push: `npm run lint && npm run typecheck && npm test && npm run build`.
- Route Handler hanya autentikasi, validasi, dan panggil service. Logika di `lib/services/**`.
- Jangan pernah `git add` berkas laporan mingguan `W*_REG_23.*`.

## Urutan

1. **Fase 0, sekarang:** A1, A2, A3 (fondasi), A4 (meals, jalur kritis, membuka Arin dan Rida), A5, A6, A7. Paralel: C2, C3, C4, C5, C6.
2. **Fase 1:** A8, I3, A9, I1, I2, A12. Tim: R1-R3, D1-D4, D6, D7.
3. **Fase 2, setelah C1:** C8, I4 jalan langsung, tes E2E, D5, R4 (laporan akurasi).
4. **Fase 3, stretch:** A13, A14, I5.

Dependensi kritis: A4 membuka halaman milik Arin dan Rida. C1 membuka semua pekerjaan Azure nyata.

---

## Adnan: Software Engineer (A)

| ID | Tugas | Berkas utama / reuse | Status | Issue |
|---|---|---|---|---|
| A1 | Fondasi API: `lib/api.ts` (`errorResponse` seragam, `requireUser()` 401 JSON, DB mati jadi 503), `lib/time-wib.ts` (batas hari WIB). Refactor `/api/recommendations` memakai keduanya | reuse `lib/db-time.ts`; ganti `setHours` lokal di `app/api/recommendations/route.ts` | SEKARANG | #46 |
| A2 | `lib/services/daily-nutrition.ts`: target terbaru + meal hari X, lalu gap. Dipakai `/api/nutrition/daily` dan rekomendasi | reuse `nutrition-gap.ts`, `nutrition-target.ts` | SEKARANG | #46 |
| A3 | Skema Zod `meal`, `checkin`, `daily`, `trends` | pola `lib/validation/schedule.ts` | SEKARANG | #9, #13, #48, #49 |
| A4 | `POST/GET /api/meals`: simpan `meal_logs` dulu, panggil estimasi, simpan `nutrition_estimates`, balas catatan + gap | reuse `lib/services/nutrition-estimate.ts` | SEKARANG | #9 |
| A5 | `GET /api/nutrition/daily` | pakai A2 | SEKARANG | #48 |
| A6 | Reproses estimasi: cari `meal_logs` tanpa estimasi, `POST /api/meals/[id]/estimate`, flag `estimasi_tertunda`. Tanpa migrasi | | SEKARANG | #47 |
| A7 | `POST /api/checkins` (satu per meal_log, cek kepemilikan) | skema `Checkin` sudah ada | SEKARANG | #13 |
| A8 | `lib/services/trend-insight.ts` agregasi energi/fokus per rentang protein (di kode) + `GET /api/trends/weekly` | | SEKARANG | #49 |
| A9 | Rate limit per pengguna untuk endpoint AI, `lib/rate-limit.ts` | arsitektur bagian 12 | SEKARANG | #50 |
| A12 | Tes integrasi Route Handler vs Postgres uji (service container CI, tanpa secret) | `.github/workflows/main.yml` | SEKARANG | #52 |
| A13 | PWA ringan: `app/manifest.ts`, service worker aset statis | ikon dari D4 | SEKARANG, prioritas rendah | #53 |
| A14 | S1 split bill: `lib/services/bill-split.ts` (murni + tes) sekarang; `POST /api/receipts`, `POST /api/receipts/[id]/shares`, halaman `/split-bill` belakangan | | `bill-split` SEKARANG; sisanya STRETCH | #17 |

## Adnan: Cloud Engineer (C)

Azure belum ada subscription, jadi C2-C7 berupa kode dan IaC yang divalidasi lokal. Yang menyentuh Azure sungguhan ada di C8.

| ID | Tugas | Status | Issue |
|---|---|---|---|
| C1 | Dapatkan subscription Azure (cek Azure for Students atau kredit lain), cek akses model Azure OpenAI di region target, pasang `az` CLI dan Bicep, budget alert | MANUAL, membuka semua C nyata | #54 |
| C2 | IaC `infra/main.bicep` + `infra/README.md` + `infra/deploy.sh`: App Service Linux Node 22, PostgreSQL Flexible, Azure OpenAI + deployment, Maps, Document Intelligence, Storage privat, Application Insights + Log Analytics. Validasi `az bicep build` | SEKARANG (tanpa apply) | #55 |
| C3 | `.github/workflows/deploy.yml`: `needs` build, OIDC `azure/login`, `prisma migrate deploy`, `azure/webapps-deploy`. `workflow_dispatch` dulu supaya tidak merah | SEKARANG | #15 |
| C4 | Next.js untuk App Service: `next.config.ts` (`output: "standalone"`), startup command, `/api/health` | SEKARANG | #15 |
| C5 | Prisma produksi: `sslmode=require`, batas pool di `lib/db.ts`, urutan migrate didokumentasikan | SEKARANG | #15 |
| C6 | `lib/logger.ts` JSON + `request_id`, tanpa password/cookie/`teks_input` utuh; `instrumentation.ts` siap Application Insights | SEKARANG | #56 |
| C7 | Lengkapi `.env.example` (`APPLICATIONINSIGHTS_CONNECTION_STRING`, dll.), perbarui architecture bagian 14 bila berubah, lengkapi cakupan #33 | SEKARANG | #33 |
| C8 | Eksekusi: provisioning, app settings, `migrate deploy`, seed sekali, deploy pertama, smoke test, budget alert | BLOKIR C1 | #33, #34, #15 |

## Adnan: AI Engineer (I)

| ID | Tugas | Status | Issue |
|---|---|---|---|
| I1 | Hardening prompt dan klien `lib/azure/openai.ts`: pembatas `teks_input`, skema ketat, verifikasi timeout 10 detik + satu retry + `max_tokens` + temperature rendah, `model_versi` | SEKARANG (mock fetch) | #57 |
| I2 | Ambang keyakinan rendah: konstanta, penanda di respons meals dan UI | SEKARANG | #10 |
| I3 | `narasiPolaDariAgregat`: maks tiga kalimat, tanpa istilah medis, validasi pasca-keluaran, template cadangan | SEKARANG (live BLOKIR C1) | #49 |
| I4 | Dataset 30-40 makanan lokal `docs/eval-estimasi.csv` + `scripts/eval-estimasi.ts` + laporan akurasi apa adanya | skrip SEKARANG; jalan live BLOKIR C1 | #58 |
| I5 | Parser OCR struk `lib/azure/docintel.ts` + fallback input manual | STRETCH; live BLOKIR C1 | #17 |

---

## Arin: Project Manager + Software Engineer

| ID | Tugas | Status | Issue |
|---|---|---|---|
| R1 | `PATCH /api/recommendations/[id]` (status `diterima`/`diabaikan`) + validasi + tes. Pola sama dengan `app/api/schedules/[id]/route.ts` | SEKARANG | #59 |
| R2 | Halaman `/rekomendasi`: form anggaran dan sela waktu, Geolocation, daftar hasil, tandai diterima, tampilkan `sumber_jarak` | R1 | #60 |
| R3 | Halaman `/profil` + UI jadwal kuliah (`/api/profile`, `/api/schedules`) | setelah layout `(app)` | #61 |
| R4 | Dokumentasi, naskah demo end-to-end, update `README.md`, laporan akurasi dari I4 | bertahap; laporan akurasi setelah I4 | #16 |
| R5 | Verifikasi data warung (`diverifikasi_pada`, jam buka, koordinat) + titik uji sekitar UGM | SEKARANG | #62 |
| R6 | QA manual halaman milik sendiri, bug dicatat sebagai issue | setelah halaman jadi | #14 |

## Rida: UI/UX Designer + Software Engineer

| ID | Tugas | Status | Issue |
|---|---|---|---|
| D1 | Selesaikan slicing (login dan signup sudah di branch `539400`): bottom-nav mobile, shell `(app)`, styling `/catat` dan `/beranda` | layout `(app)` sudah ada | #24 |
| D2 | Halaman `/tren` (Server Component, konsumsi `/api/trends/weekly`, Disclaimer) | setelah #49 | #63 |
| D3 | Komponen check-in (slider energi dan fokus) di `/catat`, memakai `POST /api/checkins` | bersama D7 | #13 |
| D4 | Ikon PWA (192/512, maskable) dan aset `public/` | SEKARANG | #64 |
| D5 | Usability testing sekitar 5 mahasiswa + iterasi desain; QA manual bagian sendiri | setelah halaman inti jadi | #23, #14 |
| D6 | Halaman `/beranda` (Server Component, gap hari ini dari `dapatkanGiziHarian` atau `GET /api/nutrition/daily`, dua sampai tiga zat terbesar, Disclaimer). Dipindahkan dari Adnan (sebelumnya A11) | layout `(app)` sudah ada | #51 |
| D7 | Halaman `/catat` (form klien `POST /api/meals`, hasil estimasi + gap, `estimasi_tertunda` dan reproses lewat `POST /api/meals/[id]/estimate`, riwayat `GET /api/meals?tanggal=`, Disclaimer). Dipindahkan dari Adnan (sebelumnya A10) | layout `(app)` sudah ada | #9, #13 |

---

## Peta tugas ke issue

| Issue | Tugas | Pemilik |
|---|---|---|
| #9 | A3, A4 (Adnan), D7 (Rida) | Adnan, Rida |
| #10 | I2 + sisa wiring | Adnan |
| #13 | A7 (Adnan), D3 + D7 (Rida) | Adnan, Rida |
| #14 | QA lintas orang, R6, D5, tes Adnan | Adnan, Arin, Rida |
| #15 | C3, C4, C5, C8 | Adnan |
| #16 | R4 | Arin |
| #17 | A14, I5 | Adnan |
| #23 | D5 | Rida |
| #24 | D1 | Rida |
| #33 | C7, C8 | Adnan |
| #34 | C8 | Adnan |
| #46 | A1, A2 | Adnan |
| #47 | A6 | Adnan |
| #48 | A5 | Adnan |
| #49 | A8, I3 | Adnan |
| #50 | A9 | Adnan |
| #51 | D6 (sebelumnya A11) | Rida |
| #52 | A12 | Adnan |
| #53 | A13 | Adnan |
| #54 | C1 | Adnan |
| #55 | C2 | Adnan |
| #56 | C6 | Adnan |
| #57 | I1 | Adnan |
| #58 | I4 | Adnan |
| #59 | R1 | Arin |
| #60 | R2 | Arin |
| #61 | R3 | Arin |
| #62 | R5 | Arin |
| #63 | D2 | Rida |
| #64 | D4 | Rida |
