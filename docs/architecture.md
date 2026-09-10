# Architecture: Kobi

**Versi:** 2.0 (Draf proyek kuliah, tech stack sudah ditetapkan)
**Bentuk produk:** Web app (responsif, dioptimalkan untuk browser ponsel)

## 1. Tujuan Dokumen

Dokumen ini menjelaskan arsitektur teknis Kobi pada level MVP semester ini: keputusan teknologi beserta alasannya, komponen sistem, kontrak API, skema data, algoritma inti, alur data utama, rencana deployment, serta batasan teknis yang perlu didokumentasikan untuk proyek kuliah.

Versi 1.0 sengaja membiarkan pilihan teknologi terbuka. Versi 2.0 mengunci pilihan tersebut supaya tim bisa langsung mulai implementasi tanpa negosiasi ulang di tengah jalan.

Dokumen pendamping:

| Dokumen | Isi |
|---|---|
| [prd.md](prd.md) | Ruang lingkup produk, fitur F1–F5 dan S1, kebutuhan fungsional |
| [erd.drawio](erd.drawio) | Entity Relationship Diagram, 12 entitas |
| [usecase-diagram.png](usecase-diagram.png) | Use case diagram, aktor dan layanan Azure |
| [brainstorm.md](brainstorm.md) | Riset kompetitor dan alasan pivot |
| [lean-canvas.md](lean-canvas.md), [canvas.md](canvas.md) | Model bisnis |

## 2. Ringkasan Keputusan Teknologi

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Bentuk produk | Web app responsif (bukan mobile native) | Tidak perlu instalasi, satu basis kode untuk semua perangkat, cukup untuk demo semester ini |
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind CSS | Server Component menekan ukuran JavaScript yang diunduh, penting karena sebagian pengguna punya keterbatasan kuota |
| Backend | Route Handlers Next.js (`app/api/**/route.ts`), TypeScript | Satu repo, satu bahasa, satu proses deploy untuk tim 3 orang dalam satu semester |
| Basis data | Azure Database for PostgreSQL Flexible Server | Skema di [erd.drawio](erd.drawio) relasional penuh: foreign key, join, agregasi gizi harian |
| ORM | Prisma | Migrasi berversi dan query type-safe, mengurangi kesalahan nama kolom |
| Autentikasi | Auth.js (NextAuth) | Sesi berbasis cookie, kredensial email/password dan opsi Google, tanpa membangun sendiri logika keamanan |
| Hosting | Azure App Service (Linux, Node 22) | Deploy langsung untuk Next.js fullstack, satu ekosistem dengan layanan AI |
| CI/CD | GitHub Actions | Repo sudah di GitHub, workflow deploy resmi tersedia untuk App Service |
| AI dan lokasi | Azure OpenAI (Microsoft Foundry), Azure Maps, Azure AI Document Intelligence | Tidak berubah dari versi 1.0 |

### 2.1 Catatan: Cosmos DB diganti PostgreSQL

Versi 1.0 menyebut "Azure Cosmos DB atau alternatif setara". Pilihan jatuh ke PostgreSQL karena:

- Perhitungan kesenjangan gizi harian adalah agregasi (`SUM`) atas `nutrition_estimates` yang di-join ke `meal_logs` dalam rentang tanggal. Ini operasi relasional.
- Split bill (S1) melibatkan tiga tabel bertingkat: `receipts` → `receipt_items` → `bill_shares`. Di document DB, relasi ini harus di-denormalisasi atau di-join manual di aplikasi.
- Rekomendasi menyaring `menu_items` berdasarkan `vendors` terdekat: join, bukan lookup satu dokumen.

Cosmos DB tetap masuk akal jika kelak dibutuhkan skala tulis global. Untuk MVP dengan 15–20 warung dan pengguna uji terbatas, itu kompleksitas tanpa manfaat.

## 3. Gambaran Arsitektur Tingkat Tinggi

```
                    [Browser pengguna]
              (responsif, dioptimalkan mobile)
                            |
                            | HTTPS
                            v
     +------------------------------------------------+
     |         Azure App Service (Linux, Node 22)      |
     |                  Next.js 16                     |
     |  +--------------------+  +-------------------+  |
     |  |  Server Component  |  |  Route Handlers   |  |
     |  |  render halaman    |  |  app/api/**       |  |
     |  +--------------------+  +-------------------+  |
     |             |                     |             |
     |             +----------+----------+             |
     |                        |                        |
     |              +---------v---------+              |
     |              |   Lapisan Service  |             |
     |              |  lib/services/**   |             |
     |              +---------+---------+              |
     +------------------------|-----------------------+
                              |
        +---------+-----------+-----------+-------------+
        |         |                       |             |
        v         v                       v             v
 [Azure OpenAI]  [Azure Maps]   [Azure AI Document]  [Prisma]
  Foundry         jarak &        Intelligence           |
  estimasi gizi   waktu tempuh   OCR struk (S1)         |
  insight pola    ke vendor                             v
  energi/fokus                             [Azure Database for
        |                                   PostgreSQL Flexible]
        |                                    - users, class_schedules
        |                                    - nutrition_targets
        |                                    - meal_logs
        |                                    - nutrition_estimates
        |                                    - checkins
        |                                    - vendors, menu_items
        |                                    - recommendations
        |                                    - receipts, receipt_items,
        |                                      bill_shares
        v
 [Azure Blob Storage]
  foto struk (S1)
```

Seluruh panggilan ke layanan Azure dilakukan dari sisi server. Kunci API tidak pernah dikirim ke browser.

## 4. Struktur Repositori

```
kobi/
  app/
    (auth)/login/page.tsx
    (auth)/register/page.tsx
    (app)/beranda/page.tsx           # kesenjangan gizi hari ini
    (app)/catat/page.tsx             # F1 input teks bebas
    (app)/rekomendasi/page.tsx       # F4
    (app)/tren/page.tsx              # F5 pola mingguan
    (app)/profil/page.tsx            # profil + jadwal kuliah
    (app)/split-bill/page.tsx        # S1 (stretch)
    api/
      auth/[...nextauth]/route.ts
      meals/route.ts                 # POST catat makan, GET riwayat
      nutrition/daily/route.ts       # GET ringkasan + gap harian
      recommendations/route.ts       # POST minta rekomendasi
      checkins/route.ts              # POST check-in energi/fokus
      trends/weekly/route.ts         # GET pola mingguan
      schedules/route.ts             # CRUD jadwal kuliah
      receipts/route.ts              # S1 unggah struk
      receipts/[id]/shares/route.ts  # S1 pembagian tagihan
      health/route.ts                # cek kesehatan untuk App Service
  components/                        # komponen UI bersama
  lib/
    azure/
      openai.ts                      # klien + pemanggilan structured output
      maps.ts                        # jarak dan waktu tempuh
      docintel.ts                    # OCR struk (S1)
    services/
      nutrition-estimate.ts          # F2 orkestrasi estimasi
      nutrition-gap.ts               # F2 perhitungan kesenjangan
      recommendation.ts              # F4 filter dan skoring
      trend-insight.ts               # F5 rangkuman pola
      bill-split.ts                  # S1 perhitungan tagihan
    db.ts                            # instance Prisma Client + adapter
    auth.ts                          # konfigurasi Auth.js
    validation/                      # skema Zod per endpoint
    generated/prisma/                # hasil `npm run db:generate`, tidak di-commit
  prisma/
    schema.prisma
    migrations/
    seed.ts                          # 15-20 warung + menu (F3)
  tests/
  prisma.config.ts                   # konfigurasi CLI Prisma 7
  vitest.config.ts
  .env.example
  .github/workflows/ci.yml
```

Perintah npm yang tersedia:

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest sekali jalan |
| `npm run db:generate` | Membuat Prisma Client |
| `npm run db:migrate` | Migrasi saat pengembangan |
| `npm run db:deploy` | Migrasi saat rilis |
| `npm run db:seed` | Mengisi data vendor awal |

Aturan: Route Handler hanya melakukan autentikasi, validasi input, dan pemanggilan service. Logika bisnis tinggal di `lib/services/**` supaya bisa diuji tanpa HTTP.

## 5. Komponen Sistem

### 5.1 Frontend

- **App Router + Server Component.** Halaman yang didominasi data (beranda, tren, riwayat) dirender di server; browser hanya menerima HTML. Client Component dipakai terbatas pada form catat makan, slider check-in, dan form rekomendasi.
- **Tailwind CSS.** Tanpa component library berat, menekan ukuran bundel.
- **Hemat kuota.** Tidak ada gambar besar di alur utama, font sistem, `next/image` hanya untuk foto struk. Target muat awal di bawah 200 KB JavaScript.
- **PWA ringan.** Manifest dan service worker untuk cache aset statis, sehingga kunjungan berikutnya hampir tidak menarik data.
- **Bahasa.** Seluruh antarmuka Bahasa Indonesia ([prd.md](prd.md), Kebutuhan Non-Fungsional).
- **Disclaimer.** Komponen disclaimer tetap ditampilkan di setiap layar yang memuat estimasi gizi atau insight energi.

### 5.2 Backend

- **Route Handlers** di `app/api/**/route.ts`, berjalan di runtime Node.
- **Validasi input** dengan Zod di setiap handler. Input tidak valid dibalas `400` sebelum menyentuh basis data atau layanan AI.
- **Format error seragam:**

  ```json
  { "error": { "code": "AI_TIMEOUT", "message": "Estimasi gizi sedang tidak tersedia, coba lagi." } }
  ```

- **Otorisasi.** Setiap query yang menyentuh data pribadi selalu menyertakan `user_id` dari sesi, bukan dari body permintaan.

### 5.3 Layanan AI dan Lokasi

| Layanan | Peran | Fitur terkait |
|---|---|---|
| Azure OpenAI (Microsoft Foundry) | Mengubah teks bebas menjadi estimasi gizi terstruktur; merangkum pola energi/fokus dalam bahasa natural | F1, F2, F5 |
| Azure Maps | Menghitung jarak dan estimasi waktu tempuh ke vendor terdekat | F4 |
| Azure AI Document Intelligence | OCR struk tulisan tangan warung untuk split bill | S1 (stretch) |
| Azure Blob Storage | Menyimpan foto struk yang diunggah | S1 (stretch) |
| Azure AI Vision/Custom Vision | Pengenalan foto makanan otomatis | Roadmap v2 |

Ketentuan pemanggilan:

- Semua pemanggilan lewat lapisan `lib/azure/**`, tidak pernah langsung dari komponen atau handler.
- Timeout 10 detik; satu kali retry untuk kegagalan sementara (429, 5xx) dengan jeda bertambah.
- Bila Azure OpenAI gagal setelah retry, catatan makan **tetap disimpan** dengan `nutrition_estimates` kosong dan ditandai untuk diproses ulang. Pengguna tidak kehilangan data.
- Hasil Azure Maps untuk pasangan (lokasi pengguna dibulatkan, vendor) di-cache di memori selama beberapa menit untuk menekan biaya panggilan.

### 5.4 Basis Data

- Azure Database for PostgreSQL Flexible Server, tier terkecil yang tersedia untuk kredit mahasiswa.
- Prisma 7 sebagai ORM; `prisma migrate` untuk perubahan skema berversi.
- Prisma 7 memisahkan connection URL dari `schema.prisma`: URL untuk CLI ada di `prisma.config.ts`, sedangkan runtime memakai driver adapter `@prisma/adapter-pg` yang dirakit di `lib/db.ts`.
- Prisma Client dihasilkan ke `lib/generated/prisma` dan tidak di-commit. CI membuatnya ulang sebelum typecheck dan build.
- Koneksi memakai SSL. Karena App Service dapat menjalankan beberapa instance, pooling koneksi diaktifkan dan jumlah koneksi Prisma dibatasi.
- Seed (`prisma/seed.ts`) mengisi 15–20 warung beserta menu dan perkiraan harga (F3). Data ini dikumpulkan manual oleh tim.

### 5.5 Autentikasi

- Auth.js (NextAuth) dengan dua provider: Credentials (email + password) dan Google (opsional, mempercepat onboarding).
- Password di-hash dengan argon2id sebelum disimpan ke kolom `users.password_hash`. Password mentah tidak pernah dicatat di log.
- Sesi disimpan di cookie `httpOnly`, `Secure`, `SameSite=Lax`, dengan masa berlaku 30 hari.
- Middleware Next.js melindungi seluruh rute di grup `(app)` dan seluruh `app/api/**` kecuali endpoint autentikasi.
- Use case Registrasi akun, Login, dan Edit profil pada [usecase-diagram.png](usecase-diagram.png) dipenuhi oleh lapisan ini.

## 6. Kontrak API

Semua respons berformat JSON. Kolom "Auth" menandai endpoint yang memerlukan sesi aktif.

| Method | Path | Body / Query | Respons | Auth | Fitur |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | `email`, `password`, `nama` | `201`, data pengguna tanpa hash | – | Registrasi |
| POST | `/api/auth/callback/credentials` | `email`, `password` | Cookie sesi | – | Login |
| GET | `/api/profile` | – | Profil + preferensi anggaran | Ya | Edit profil |
| PATCH | `/api/profile` | `nama`, `tanggal_lahir`, `jenis_kelamin`, `berat_badan_kg`, `tinggi_badan_cm`, `preferensi_anggaran` | Profil terbaru | Ya | Edit profil |
| GET | `/api/schedules` | – | Daftar jadwal kuliah | Ya | F4 |
| POST | `/api/schedules` | `mata_kuliah`, `hari`, `jam_mulai`, `jam_selesai`, `lokasi_ruang` | `201`, jadwal baru | Ya | F4 |
| DELETE | `/api/schedules/{id}` | – | `204` | Ya | F4 |
| POST | `/api/meals` | `teks_input`, `waktu_makan`, `vendor_id` (opsional), `total_harga` (opsional) | `201`, catatan makan + estimasi gizi | Ya | F1, F2 |
| GET | `/api/meals` | `tanggal` | Riwayat makan pada tanggal itu | Ya | F1 |
| GET | `/api/nutrition/daily` | `tanggal` | Target, akumulasi, dan kesenjangan gizi | Ya | F2 |
| POST | `/api/recommendations` | `batas_anggaran`, `sela_waktu_menit`, `latitude`, `longitude` | Daftar menu + vendor terurut | Ya | F4 |
| POST | `/api/checkins` | `meal_log_id`, `tingkat_energi`, `tingkat_fokus`, `catatan` | `201`, check-in tersimpan | Ya | F5 |
| GET | `/api/trends/weekly` | `minggu` (opsional) | Ringkasan pola energi/fokus + narasi | Ya | F5 |
| POST | `/api/receipts` | `multipart/form-data`, berkas foto struk | `201`, `status_ocr` dan daftar item hasil OCR | Ya | S1 |
| POST | `/api/receipts/{id}/shares` | Daftar `{ receipt_item_id, user_id, porsi }` | Total tagihan per orang | Ya | S1 |

## 7. Skema Data Detail

Diagram lengkap: [erd.drawio](erd.drawio). Seluruh tabel memakai `id` bertipe `uuid` sebagai primary key.

### 7.1 Pengguna dan jadwal

**users**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| email | text, unique, not null | Dipakai untuk login |
| password_hash | text | argon2id; kosong bila mendaftar lewat Google |
| nama | text, not null | |
| tanggal_lahir | date | Bahan hitung kebutuhan gizi |
| jenis_kelamin | text | Bahan hitung kebutuhan gizi |
| berat_badan_kg | numeric(5,2) | |
| tinggi_badan_cm | numeric(5,2) | |
| preferensi_anggaran | integer | Anggaran makan harian dalam rupiah |
| dibuat_pada | timestamptz, default now() | |

**class_schedules**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users, on delete cascade | |
| mata_kuliah | text | |
| hari | smallint | 1 = Senin sampai 7 = Minggu |
| jam_mulai | time | |
| jam_selesai | time | |
| lokasi_ruang | text | |

Index: `(user_id, hari)`.

**nutrition_targets**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | |
| kalori_target | integer | Disimpan, tetapi tidak ditonjolkan di antarmuka |
| protein_target_g | numeric(6,2) | |
| karbohidrat_target_g | numeric(6,2) | |
| lemak_target_g | numeric(6,2) | |
| zat_besi_target_mg | numeric(6,2) | |
| berlaku_sejak | date | Target berversi; profil berubah membuat baris baru, bukan menimpa |

### 7.2 Pencatatan makan

**meal_logs**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users, on delete cascade | |
| vendor_id | uuid FK → vendors, nullable | Kosong bila masak sendiri atau vendor tidak terdaftar |
| teks_input | text, not null | Teks asli pengguna, disimpan apa adanya |
| sumber_makanan | text | warung / kaki lima / pasar / masak sendiri / lainnya |
| total_harga | integer | Rupiah, opsional |
| waktu_makan | timestamptz, not null | |
| dibuat_pada | timestamptz, default now() | |

Index: `(user_id, waktu_makan desc)` — dipakai hampir semua query riwayat dan agregasi harian.

**nutrition_estimates**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| meal_log_id | uuid FK → meal_logs, unique, on delete cascade | Relasi 1:1 |
| kalori_estimasi | integer | |
| protein_g | numeric(6,2) | |
| karbohidrat_g | numeric(6,2) | |
| lemak_g | numeric(6,2) | |
| zat_besi_mg | numeric(6,2) | |
| tingkat_keyakinan | numeric(3,2) | 0.00–1.00, dari model |
| model_versi | text | Nama deployment + tanggal prompt, agar hasil bisa ditelusuri |
| dibuat_pada | timestamptz, default now() | |

**checkins**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users, on delete cascade | |
| meal_log_id | uuid FK → meal_logs, unique | Satu check-in per catatan makan |
| tingkat_energi | smallint | Skala 1–5 |
| tingkat_fokus | smallint | Skala 1–5 |
| catatan | text | Opsional |
| waktu | timestamptz, default now() | |

### 7.3 Vendor dan menu

**vendors**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| nama_warung | text, not null | |
| jenis_vendor | text | warung / kaki lima / pasar |
| alamat | text | |
| latitude | numeric(9,6) | |
| longitude | numeric(9,6) | |
| jam_buka | time | Perkiraan; jam operasional informal memang tidak tetap |
| jam_tutup | time | |
| diverifikasi_pada | date | Kapan tim terakhir mengecek data ini ke lapangan |

Index: `(latitude, longitude)` untuk penyaringan awal kotak koordinat sebelum memanggil Azure Maps.

**menu_items**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| vendor_id | uuid FK → vendors, on delete cascade | |
| nama_menu | text, not null | |
| estimasi_harga | integer | Rupiah |
| estimasi_kalori | integer | |
| estimasi_protein_g | numeric(6,2) | |
| tersedia | boolean, default true | |

Index: `(vendor_id, estimasi_harga)`.

**recommendations**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | |
| menu_item_id | uuid FK → menu_items | |
| vendor_id | uuid FK → vendors | Disimpan langsung agar riwayat tetap terbaca bila menu dihapus |
| gizi_disasar | text | Zat gizi yang hendak ditutup, contoh: protein |
| batas_anggaran | integer | |
| sela_waktu_menit | integer | |
| jarak_meter | integer | Dari Azure Maps |
| status | text | ditampilkan / diterima / diabaikan |
| waktu_dibuat | timestamptz, default now() | |

Tabel ini menyimpan riwayat rekomendasi, sekaligus bahan evaluasi apakah saran benar-benar dipakai.

### 7.4 Split bill (S1, stretch)

**receipts**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | Pengunggah |
| vendor_id | uuid FK → vendors, nullable | |
| url_gambar | text | Path di Azure Blob Storage, bukan URL publik |
| total_tagihan | integer | |
| status_ocr | text | menunggu / berhasil / gagal |
| waktu_unggah | timestamptz, default now() | |

**receipt_items**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| receipt_id | uuid FK → receipts, on delete cascade | |
| nama_item | text | Hasil OCR, dapat dikoreksi pengguna |
| jumlah | integer | |
| harga_satuan | integer | |
| subtotal | integer | |

**bill_shares**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| receipt_item_id | uuid FK → receipt_items, on delete cascade | |
| user_id | uuid FK → users | Penanggung item |
| porsi | numeric(4,2) | Bagian yang ditanggung, contoh 0.50 |
| jumlah_bayar | integer | `subtotal * porsi`, dibulatkan |
| status_bayar | text | belum / lunas |

## 8. Alur Data Utama

### 8.1 Registrasi, login, dan pengaturan profil

1. Pengguna mendaftar lewat `POST /api/auth/register`. Handler memvalidasi email dan kekuatan password, meng-hash password dengan argon2id, lalu membuat baris `users`.
2. Setelah profil dasar terisi lewat `PATCH /api/profile`, service menghitung kebutuhan gizi harian dan menyimpannya sebagai baris `nutrition_targets` dengan `berlaku_sejak` hari itu (lihat bagian 10).
3. Login lewat `POST /api/auth/callback/credentials` menghasilkan cookie sesi. Provider Google tersedia sebagai jalur alternatif; pengguna Google punya `password_hash` kosong.
4. Jadwal kuliah dikelola lewat `GET`/`POST /api/schedules` dan `DELETE /api/schedules/{id}`, tersimpan di `class_schedules`. Data ini dipakai fitur rekomendasi untuk menghitung sela waktu antar kuliah.
5. Perubahan berat badan atau data profil lain membuat baris `nutrition_targets` **baru**, bukan menimpa yang lama, sehingga kesenjangan gizi masa lalu tetap dihitung dengan target yang berlaku saat itu.

### 8.2 Pencatatan makan dan estimasi gizi (F1, F2)

1. Pengguna mengetik makanan dalam bahasa sehari-hari di `/catat`, contoh: `"nasi telur dan es teh dari warung deket kost"`.
2. Browser mengirim `POST /api/meals`.
3. Handler memvalidasi input, mengambil `user_id` dari sesi, lalu menyimpan baris `meal_logs` lebih dulu. Catatan pengguna aman meski langkah AI gagal.
4. `lib/services/nutrition-estimate.ts` memanggil Azure OpenAI dengan structured output (lihat bagian 9). Contoh balasan model:

   ```json
   {
     "items": [
       { "nama": "nasi putih", "porsi": "1 piring" },
       { "nama": "telur dadar", "porsi": "1 butir" },
       { "nama": "es teh manis", "porsi": "1 gelas" }
     ],
     "kalori_estimasi": 520,
     "protein_g": 14.5,
     "karbohidrat_g": 78.0,
     "lemak_g": 15.2,
     "zat_besi_mg": 2.1,
     "estimasi_harga": 12000,
     "tingkat_keyakinan": 0.72
   }
   ```

5. Hasil disimpan ke `nutrition_estimates` bersama `model_versi`.
6. `lib/services/nutrition-gap.ts` menghitung akumulasi harian dan kesenjangan (bagian 10), lalu handler mengembalikan catatan makan beserta ringkasan gap.
7. Antarmuka menampilkan kekurangan gizi dalam bahasa sederhana, disertai disclaimer.
8. Halaman beranda memuat ringkasan hari berjalan lewat `GET /api/nutrition/daily`, yang memakai perhitungan yang sama.

### 8.3 Rekomendasi lokasi dan menu (F4)

1. Pengguna membuka `/rekomendasi`, mengisi batas anggaran dan sela waktu. Lokasi diambil dari Geolocation API browser setelah izin diberikan.
2. Browser mengirim `POST /api/recommendations`. Bila `sela_waktu_menit` dikosongkan, service membacanya dari `class_schedules` (`GET /api/schedules`).
3. Service mengambil kesenjangan gizi hari itu, lalu menyaring `vendors` dalam kotak koordinat sekitar pengguna dan yang sedang buka pada jam tersebut.
4. Azure Maps menghitung jarak dan waktu tempuh ke kandidat vendor yang lolos penyaringan awal.
5. `menu_items` disaring terhadap `batas_anggaran`, lalu diberi skor terhadap gap gizi (bagian 11).
6. Kandidat teratas disimpan ke `recommendations` dengan status `ditampilkan`, lalu dikembalikan ke pengguna.
7. Bila pengguna memilih salah satu, statusnya diperbarui menjadi `diterima`.

### 8.4 Check-in energi dan fokus (F5)

1. Setelah menyimpan catatan makan, antarmuka menawarkan check-in singkat: dua slider 1–5.
2. Browser mengirim `POST /api/checkins` berisi `meal_log_id`.
3. Data tersimpan di `checkins`.
4. Pada `GET /api/trends/weekly`, service menggabungkan `checkins` dengan `nutrition_estimates` melalui `meal_logs`, lalu menghitung rata-rata energi dan fokus per rentang asupan protein.
5. Angka hasil agregasi dikirim ke Azure OpenAI untuk dirangkai menjadi narasi Bahasa Indonesia yang mudah dibaca. Model hanya merangkai kalimat dari angka yang sudah dihitung, tidak menghitung sendiri.
6. Narasi selalu ditampilkan bersama disclaimer bahwa ini bukan diagnosis medis.

### 8.5 Split bill via OCR struk (S1, stretch)

1. Pengguna memfoto struk warung. Browser mengompres gambar sebelum mengunggah.
2. `POST /api/receipts` menyimpan berkas ke Azure Blob Storage dan membuat baris `receipts` dengan `status_ocr = menunggu`.
3. Berkas dikirim ke Azure AI Document Intelligence.
4. Hasil OCR diurai menjadi baris-baris `receipt_items`; `status_ocr` menjadi `berhasil` atau `gagal`.
5. Pengguna mengoreksi item yang salah baca, lalu menandai siapa menanggung apa.
6. `POST /api/receipts/{id}/shares` menyimpan `bill_shares` dan mengembalikan total per orang.

## 9. Kontrak Model AI

### 9.1 Estimasi gizi (F2)

Pemanggilan Azure OpenAI memakai structured output dengan skema JSON tetap:

```json
{
  "type": "object",
  "required": ["items", "kalori_estimasi", "protein_g", "karbohidrat_g",
               "lemak_g", "zat_besi_mg", "tingkat_keyakinan"],
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["nama", "porsi"],
        "properties": { "nama": { "type": "string" }, "porsi": { "type": "string" } }
      }
    },
    "kalori_estimasi": { "type": "integer" },
    "protein_g": { "type": "number" },
    "karbohidrat_g": { "type": "number" },
    "lemak_g": { "type": "number" },
    "zat_besi_mg": { "type": "number" },
    "estimasi_harga": { "type": "integer" },
    "tingkat_keyakinan": { "type": "number" }
  }
}
```

Garis besar system prompt:

- Peran: ahli gizi yang memperkirakan kandungan gizi makanan Indonesia, termasuk makanan warung dan kaki lima.
- Input berupa bahasa sehari-hari, kerap tanpa takaran. Perkirakan porsi lazim mahasiswa bila takaran tidak disebut.
- Kenali penamaan lokal seperti nasi kucing, gudeg, es teh tawar, indomie telur, dan sejenisnya.
- Kembalikan `tingkat_keyakinan` rendah bila makanan tidak dikenali. Jangan mengarang angka tanpa penanda.
- Balas hanya JSON sesuai skema, tanpa teks tambahan.

Suhu (temperature) diatur rendah demi kestabilan hasil. `model_versi` diisi nama deployment ditambah tanggal revisi prompt, sehingga estimasi lama tetap bisa ditelusuri saat prompt berubah.

### 9.2 Narasi pola energi dan fokus (F5)

Model menerima angka hasil agregasi dan hanya bertugas menyusun kalimat. Batasannya: tanpa istilah medis, tanpa klaim sebab-akibat, tanpa saran pengobatan, maksimal tiga kalimat. Perhitungan tidak boleh diserahkan ke model.

## 10. Algoritma Kesenjangan Gizi

1. **Target harian.** Diambil dari `nutrition_targets` yang `berlaku_sejak`-nya paling akhir untuk pengguna tersebut. Bila belum ada, target dihitung dari data profil (usia dari `tanggal_lahir`, `jenis_kelamin`, `berat_badan_kg`, `tinggi_badan_cm`) dengan rumus kebutuhan energi dan gizi umum, lalu disimpan sebagai baris baru.
2. **Akumulasi.** Jumlahkan seluruh `nutrition_estimates` yang di-join ke `meal_logs` milik pengguna pada tanggal yang diminta.
3. **Kesenjangan.** `gap = target - akumulasi` untuk protein, karbohidrat, lemak, dan zat besi. Nilai negatif berarti sudah terpenuhi.
4. **Penyajian.** Antarmuka menampilkan dua sampai tiga zat gizi dengan kekurangan terbesar dalam bahasa sederhana, contoh: "Protein masih kurang sekitar 20 gram hari ini." Angka kalori tersedia jika dibuka pengguna, tetapi tidak menjadi tampilan utama — ini keputusan etis yang tercatat di [prd.md](prd.md) bagian 12.
5. **Keyakinan rendah.** Catatan makan dengan `tingkat_keyakinan` di bawah ambang tertentu tetap dihitung, tetapi ditandai di antarmuka agar pengguna tahu estimasi itu kurang pasti.

## 11. Algoritma Rekomendasi (F4)

Tahapan berurutan, dari yang paling murah secara komputasi:

1. **Saring lokasi.** Ambil vendor dalam kotak koordinat sekitar pengguna langsung dari basis data. Menghindari pemanggilan Azure Maps untuk vendor yang jelas terlalu jauh.
2. **Saring jam buka.** Buang vendor yang menurut `jam_buka`/`jam_tutup` sedang tutup. Karena jam operasional informal tidak tetap, hasilnya ditandai sebagai perkiraan.
3. **Hitung jarak.** Azure Maps menghitung jarak dan waktu tempuh untuk kandidat yang tersisa.
4. **Saring waktu.** Buang vendor yang waktu tempuh pulang-pergi ditambah perkiraan waktu makan melebihi `sela_waktu_menit`.
5. **Saring anggaran.** Ambil `menu_items` dengan `estimasi_harga` di bawah `batas_anggaran` dan `tersedia = true`.
6. **Beri skor.** Setiap menu dinilai atas tiga hal: seberapa besar menutup gap gizi terbesar, sisa anggaran setelah membeli, dan kedekatan lokasi. Bobot ditulis eksplisit sebagai konstanta di `lib/services/recommendation.ts` supaya mudah disetel saat uji coba.
7. **Kembalikan** tiga sampai lima menu teratas dan simpan ke `recommendations`.

Sela waktu antar kuliah dibaca dari `class_schedules` bila pengguna tidak mengisi manual.

## 12. Keamanan dan Privasi

- Data pribadi (riwayat makan, check-in energi) hanya dapat diakses pemiliknya. Setiap query menyertakan `user_id` dari sesi server, tidak pernah dari parameter yang dikirim klien.
- Password di-hash dengan argon2id. Tidak ada password mentah di log maupun di respons API.
- Cookie sesi: `httpOnly`, `Secure`, `SameSite=Lax`.
- Seluruh kunci layanan Azure, string koneksi basis data, dan rahasia Auth.js disimpan di Application Settings App Service (atau Azure Key Vault), tidak pernah masuk repo. Repo hanya memuat `.env.example` tanpa nilai.
- Komunikasi ke seluruh layanan Azure dan ke basis data memakai HTTPS/TLS.
- Endpoint yang memanggil layanan AI dibatasi lajunya per pengguna, untuk membendung biaya dan penyalahgunaan.
- Foto struk disimpan di container privat. Akses lewat URL bertanda tangan berumur pendek, bukan URL publik.
- Tidak ada data individu yang dibagikan ke pihak ketiga dalam bentuk teridentifikasi. Data vendor bersifat publik/agregat sehingga aman untuk analisis lanjutan.
- Penghapusan akun menghapus seluruh data turunannya lewat `on delete cascade`.
- Estimasi gizi dan insight energi/fokus selalu disertai disclaimer bahwa hasil bersifat perkiraan, bukan nasihat medis atau gizi profesional.

## 13. Performa dan Efisiensi Kuota

| Aspek | Target dan cara |
|---|---|
| Waktu respons `POST /api/meals` | Di bawah 5 detik ([prd.md](prd.md) bagian 7). Prompt ringkas, `max_tokens` dibatasi, satu kali panggilan model saja |
| Ukuran halaman | Server Component sebagai default; JavaScript awal ditargetkan di bawah 200 KB |
| Panggilan Azure Maps | Penyaringan kotak koordinat lebih dulu; hasil di-cache beberapa menit |
| Unggah foto struk | Dikompres di browser sebelum dikirim; batas ukuran berkas ditegakkan di server |
| Query basis data | Index `(user_id, waktu_makan desc)` untuk agregasi harian dan mingguan |
| Kunjungan berulang | Service worker men-cache aset statis |

## 14. Deployment dan Environment

**Sumber daya Azure**

| Sumber daya | Keperluan |
|---|---|
| App Service (Linux, Node 22) | Menjalankan Next.js |
| Azure Database for PostgreSQL Flexible Server | Basis data utama |
| Azure OpenAI (Microsoft Foundry) | Deployment model untuk estimasi gizi dan narasi |
| Azure Maps | Account dengan subscription key |
| Azure AI Document Intelligence | S1, stretch |
| Azure Blob Storage | Foto struk, S1 |
| Application Insights | Telemetri |

**Variabel environment**

```
DATABASE_URL
AUTH_SECRET
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY
AZURE_OPENAI_DEPLOYMENT
AZURE_MAPS_KEY
AZURE_DOCINTEL_ENDPOINT
AZURE_DOCINTEL_KEY
AZURE_STORAGE_CONNECTION_STRING
```

**CI (sudah berjalan)**

`.github/workflows/ci.yml` jalan pada setiap push dan setiap pull request ke `main`, dengan urutan: `npm ci` → `npm run db:generate` → lint → typecheck → test → build. Prisma Client dibuat ulang di CI karena hasil generate tidak di-commit. CI tidak menyentuh basis data mana pun, jadi tidak memerlukan satu pun secret.

**Deploy (belum dibuat)**

Workflow deploy sengaja ditunda sampai resource Azure benar-benar ada. Menambahkannya lebih dulu hanya menghasilkan run merah di setiap push, dan tim akan terbiasa mengabaikan status CI. Rencana ketika resource sudah siap:

1. Tambahkan job `deploy` di workflow yang sama, dengan `needs: build` dan `if: github.ref == 'refs/heads/main'`.
2. Autentikasi memakai OIDC (`azure/login` dengan federated credential), **bukan** publish profile. Publish profile berisi kredensial berumur panjang yang harus dirotasi manual bila bocor lewat log.
3. `prisma migrate deploy` dijalankan terhadap basis data target sebelum aplikasi baru menerima trafik.
4. Artefak build dideploy ke App Service.
5. Seed vendor (`prisma/seed.ts`) dijalankan manual, sekali saja, bukan pada setiap rilis.

**Pengembangan lokal**

PostgreSQL lewat Docker, lalu salin `.env.example` menjadi `.env.local` dan isi nilainya. Jalankan `npm run db:generate` sekali setelah clone, karena Prisma Client tidak ikut di repo.

## 15. Observability dan Error Handling

- Application Insights mencatat waktu respons, tingkat kegagalan, dan durasi panggilan layanan Azure.
- Log berbentuk terstruktur dan memuat `request_id`. Log tidak pernah memuat password, isi cookie, maupun teks `teks_input` secara utuh.
- Kegagalan Azure OpenAI dicatat lengkap dengan jenis galat, agar akurasi dan keandalan bisa dilaporkan apa adanya sesuai [prd.md](prd.md) bagian 8.
- Perilaku saat layanan bermasalah:

| Kegagalan | Perilaku |
|---|---|
| Azure OpenAI timeout atau galat | Catatan makan tetap tersimpan tanpa estimasi, ditandai untuk diproses ulang, pengguna diberi tahu |
| Azure Maps galat | Rekomendasi tetap tampil memakai jarak garis lurus, ditandai sebagai perkiraan kasar |
| Document Intelligence galat | `status_ocr = gagal`, pengguna dapat memasukkan item struk secara manual |
| Basis data tidak dapat dijangkau | Balas `503` dengan pesan Bahasa Indonesia, tanpa membocorkan detail internal |

## 16. Strategi Testing

| Tingkat | Cakupan |
|---|---|
| Unit | `nutrition-gap.ts` (perhitungan target dan gap), `recommendation.ts` (penyaringan dan skoring), `bill-split.ts` (pembagian tagihan). Klien Azure diganti tiruan |
| Integrasi | Route Handler diuji terhadap basis data uji: alur register, login, catat makan, rekomendasi, check-in |
| Kontrak AI | Sekumpulan teks masukan contoh dijalankan ke Azure OpenAI, hasilnya divalidasi terhadap skema JSON bagian 9 |
| Akurasi | Sampel catatan makan dibandingkan dengan penilaian manual. Hasilnya didokumentasikan apa adanya, tidak diklaim sempurna ([prd.md](prd.md) bagian 4) |
| Manual | Naskah demo end-to-end memakai data seed 15–20 warung |

## 17. Batasan Teknis MVP vs Roadmap

| Aspek | MVP (semester ini) | Roadmap |
|---|---|---|
| Bentuk produk | Web app responsif | Aplikasi mobile native atau PWA penuh dengan mode luring |
| Input makanan | Teks bebas | Foto otomatis (computer vision) |
| Basis data vendor | Diisi manual, 15 sampai 20 warung | Crowdsourcing dari pengguna |
| Rekomendasi lokasi | Basis data statis + Azure Maps | Data real-time dari komunitas |
| Split bill | OCR struk sederhana (stretch) | Integrasi pembayaran langsung |
| Integrasi jadwal kuliah | Input manual oleh pengguna | Integrasi otomatis ke sistem akademik kampus |
| Hosting | Satu App Service, satu region | Autoscale, staging slot, CDN |
| Pemrosesan AI | Sinkron di dalam permintaan HTTP | Antrean latar belakang untuk estimasi ulang massal |

## 18. Referensi

Dokumen ini melengkapi [prd.md](prd.md), [brainstorm.md](brainstorm.md), [lean-canvas.md](lean-canvas.md), dan [canvas.md](canvas.md). Skema data mengacu pada [erd.drawio](erd.drawio); cakupan use case mengacu pada [usecase-diagram.png](usecase-diagram.png).
