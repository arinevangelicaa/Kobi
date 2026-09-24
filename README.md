# Kobi

Aplikasi berbasis AI yang membantu mahasiswa melacak kebutuhan gizi dan menemukan makanan terjangkau dari ekonomi pangan informal — warung, kaki lima, dan pasar di sekitar kampus.

*Project Senior Project TI — Departemen Teknik Elektro dan Teknologi Informasi, Fakultas Teknik, Universitas Gadjah Mada*

---

## Tentang

Mahasiswa dengan jadwal kuliah padat sering kesulitan makan dengan gizi seimbang karena keterbatasan waktu, anggaran, dan informasi tentang tempat makan terdekat yang sesuai kebutuhan mereka. Aplikasi pelacak gizi yang ada saat ini dibangun untuk sistem pangan formal — kantin dengan menu tetap, supermarket berbarcode, dan basis data nutrisi resmi — sehingga tidak berfungsi baik untuk makanan warung atau kaki lima yang menjadi sumber makan utama mahasiswa Indonesia.

Kobi mencatat pola makan dalam bahasa sehari-hari, menganalisis kesenjangan gizi harian (bukan sekadar hitung kalori), dan merekomendasikan menu bergizi dengan anggaran terbatas dari vendor terdekat, disesuaikan dengan sela jadwal kuliah pengguna.

## Masalah yang Diselesaikan

1. Sulit makan bergizi karena jadwal kuliah padat
2. Warung dan kaki lima tidak punya info gizi resmi
3. Sulit tahu tempat makan terdekat sesuai anggaran

## Diferensiasi

Riset kompetitor (BeCute, Bussin, CollegeMacros, Studelicious, PlateLens) menunjukkan hampir seluruh fitur yang direncanakan sudah tersedia di pasar, namun seluruh kompetitor dibangun untuk sistem pangan negara maju. Tidak ada yang menangani vendor tanpa label gizi atau barcode, transaksi tunai dengan harga informal, jam operasional tidak tetap, serta penamaan makanan lokal seperti "nasi kucing", "gudeg", atau "es teh tawar".

- **Input teks bebas** untuk makanan warung tanpa label gizi, bukan pemindaian barcode
- **Basis data vendor informal** yang tidak dijangkau kompetitor manapun
- **Pendekatan kesenjangan gizi**, bukan hitung kalori — keputusan etis, bukan sekadar teknis

Analisis kompetitor lengkap: [docs/brainstorm.md](docs/brainstorm.md)

## Fitur

### MVP

| ID | Fitur | Deskripsi |
|---|---|---|
| F1 | Pencatatan makan teks bebas | Pengguna mengetik apa yang dimakan dalam bahasa sehari-hari, contoh: "nasi telur dan es teh dari warung deket kost" |
| F2 | Estimasi dan analisis kesenjangan gizi | Model AI memperkirakan kandungan gizi dan membandingkannya dengan kebutuhan harian, menampilkan kekurangan seperti protein atau zat besi, bukan hitungan kalori |
| F3 | Basis data vendor lokal | Basis data awal 15 sampai 20 warung di sekitar kampus, disiapkan manual, lengkap dengan perkiraan menu dan harga |
| F4 | Rekomendasi lokasi dan waktu | Menyarankan menu spesifik dari warung terdekat yang menutup kesenjangan gizi, memperhitungkan sisa waktu luang antar jadwal kuliah |
| F5 | Check-in energi dan fokus | Setelah mencatat makan, pengguna mengisi tingkat energi dan fokus secara singkat; setelah beberapa minggu aplikasi menampilkan pola dalam bahasa sederhana tanpa klaim medis |

### Stretch Goal

| ID | Fitur | Deskripsi |
|---|---|---|
| S1 | Split bill via OCR struk | Foto struk tulisan tangan warung diproses untuk membagi tagihan sesuai pesanan masing-masing saat makan bersama |

### Roadmap (di luar cakupan proyek ini)

- Pencatatan makan bersama secara sosial/real-time
- Pengenalan foto makanan otomatis (computer vision), membutuhkan dataset yang belum ada
- Crowdsourcing data vendor skala besar dari pengguna
- Lisensi data agregat ke pihak ketiga, seperti dinas kesehatan atau platform pesan-antar

## Arsitektur

```
[Aplikasi Klien (Web/Mobile ringan)]
              |
              v
      [API Layer / Backend]
              |
   +----------+----------+---------------------+
   |                     |                     |
   v                     v                     v
[Azure OpenAI       [Azure Maps]      [Azure AI Document
 via Microsoft       jarak & lokasi    Intelligence]
 Foundry]            vendor            OCR struk (stretch)
 estimasi gizi &
 insight energi/fokus
   |                     |                     |
   +----------+----------+---------------------+
              |
              v
     [Basis Data (Azure Cosmos DB atau setara)]
      - users
      - meal_logs
      - vendors
      - checkins (energi/fokus)
```

| Layanan | Peran | Fitur terkait |
|---|---|---|
| Azure OpenAI (Microsoft Foundry) | Mengubah teks bebas menjadi estimasi gizi terstruktur, menghasilkan insight pola energi/fokus dalam bahasa natural | F1, F2, F5 |
| Azure Maps | Menghitung jarak dan estimasi waktu tempuh ke vendor terdekat | F4 |
| Azure AI Document Intelligence | OCR struk tulisan tangan warung untuk fitur split bill | S1 (stretch) |
| Azure AI Vision/Custom Vision | Pengenalan foto makanan otomatis | Roadmap v2 |

### Tech Stack

| Lapisan | Pilihan |
|---|---|
| Bentuk produk | Web app responsif, dioptimalkan untuk browser ponsel |
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind CSS |
| Backend | Route Handlers Next.js, satu repo dengan frontend |
| Basis data | Azure Database for PostgreSQL Flexible Server + Prisma |
| Autentikasi | Auth.js (NextAuth), email/password + Google |
| Hosting | Azure App Service (Linux, Node 22) + GitHub Actions |

Detail arsitektur, kontrak API, skema kolom, dan algoritma: [docs/architecture.md](docs/architecture.md)

## Menjalankan Secara Lokal

Butuh Node.js 22 atau lebih baru dan PostgreSQL.

```bash
npm install                    # sekaligus mengaktifkan git hook repo
cp .env.example .env            # isi DATABASE_URL dan kunci layanan Azure
npm run db:generate            # Prisma Client tidak ikut di repo
npm run db:migrate             # membuat tabel di basis data lokal
npm run dev                    # http://localhost:3000
```

### Aturan Commit

Pesan commit hanya satu baris subjek, tanpa body dan tanpa trailer atribusi.
Aturan ini ditegakkan oleh [.githooks/commit-msg](.githooks/commit-msg).

`npm install` menjalankan `git config core.hooksPath .githooks` lewat skrip
`prepare`. Kalau melewatkan `npm install`, aktifkan manual:

```bash
git config core.hooksPath .githooks
```

Perintah lain: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

Setiap push dan pull request ke `main` menjalankan lint, typecheck, test, dan build lewat
[.github/workflows/ci.yml](.github/workflows/ci.yml). Workflow deploy belum dibuat, menunggu
resource Azure disiapkan.

## Skema Data

12 tabel relasional. Diagram lengkap: [docs/erd.drawio](docs/erd.drawio) — tipe kolom dan index ada di [docs/architecture.md](docs/architecture.md).

| Kelompok | Tabel |
|---|---|
| Pengguna dan jadwal | `users`, `class_schedules`, `nutrition_targets` |
| Pencatatan makan | `meal_logs`, `nutrition_estimates`, `checkins` |
| Vendor dan rekomendasi | `vendors`, `menu_items`, `recommendations` |
| Split bill (stretch) | `receipts`, `receipt_items`, `bill_shares` |

## Alur Pengguna Utama

1. Pengguna membuka aplikasi dan mencatat makanan yang baru dikonsumsi dalam teks bebas.
2. Aplikasi menampilkan estimasi gizi dan kesenjangan gizi harian saat itu.
3. Aplikasi menanyakan tingkat energi dan fokus pengguna secara singkat.
4. Jika ada celah waktu di jadwal kuliah pengguna, aplikasi menyarankan menu dan warung terdekat yang menutup kesenjangan gizi dalam anggaran yang ditentukan.
5. Pengguna dapat melihat pola mingguan dari riwayat makan dan check-in energi/fokus.

## Batasan dan Catatan Etis

- Basis data vendor pada tahap ini disiapkan manual, bukan hasil crowdsourcing otomatis.
- Estimasi gizi bersifat perkiraan berbasis pengetahuan umum model AI, bukan hasil uji laboratorium. Akurasi didokumentasikan apa adanya, tidak diklaim sempurna.
- Jadwal kuliah diinput manual oleh pengguna, tanpa integrasi otomatis ke sistem akademik kampus.
- Kobi secara sengaja tidak menonjolkan angka kalori sebagai metrik utama, melainkan kesenjangan gizi dan kesesuaian anggaran. Aplikasi ini **bukan pengganti konsultasi ahli gizi** dan tidak memberikan nasihat medis.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [docs/index.md](docs/index.md) | Ringkasan proyek dan profil kelompok |
| [docs/prd.md](docs/prd.md) | Product Requirements Document lengkap |
| [docs/architecture.md](docs/architecture.md) | Arsitektur teknis, alur data, skema data |
| [docs/brainstorm.md](docs/brainstorm.md) | Riset kompetitor dan evolusi ide |
| [docs/lean-canvas.md](docs/lean-canvas.md) | Lean Canvas |
| [docs/canvas.md](docs/canvas.md) | Business Model Canvas |

## Tim

**Kelompok Kibo** — Departemen Teknik Elektro dan Teknologi Informasi, Fakultas Teknik, Universitas Gadjah Mada

| Nama | NIM | Peran |
|---|---|---|
| Adnan Abdul Majid (Ketua) | 24/544058/TK/60471 | Software Engineer, Cloud Engineer, AI Engineer |
| Arin Evangelica Patabang | 24/534030/TK/59182 | Project Manager, Software Engineer |
| Rida Larasati | 24/539400/TK/59821 | UI/UX Designer, Software Engineer |
