# Architecture: Kobi

**Versi:** 1.0 (Draf proyek kuliah)

## 1. Tujuan Dokumen

Dokumen ini menjelaskan arsitektur teknis Kobi pada level MVP semester ini, termasuk komponen sistem, peran masing-masing layanan Azure, alur data utama, dan batasan teknis yang perlu didokumentasikan untuk proyek kuliah.

## 2. Gambaran Arsitektur Tingkat Tinggi

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

## 3. Komponen Sistem

### 3.1 Aplikasi Klien

Aplikasi web atau mobile ringan yang dioptimalkan untuk pengguna dengan keterbatasan kuota internet. Fungsi utama: input teks bebas untuk catatan makan, tampilan kesenjangan gizi harian, rekomendasi lokasi dan menu, serta check-in energi dan fokus.

### 3.2 API Layer / Backend

Menerima permintaan dari aplikasi klien, mengorkestrasi pemanggilan ke layanan AI Azure, mengelola sesi dan data pengguna. Dapat dibangun dengan framework umum seperti Node.js/Express atau Python/FastAPI, disesuaikan dengan preferensi tim.

### 3.3 Layanan AI

| Layanan | Peran | Fitur terkait |
|---|---|---|
| Azure OpenAI (Microsoft Foundry) | Mengubah teks bebas menjadi estimasi gizi terstruktur, menghasilkan insight pola energi/fokus dalam bahasa natural | F1, F2, F5 |
| Azure Maps | Menghitung jarak dan estimasi waktu tempuh ke vendor terdekat | F4 |
| Azure AI Document Intelligence | OCR struk tulisan tangan warung untuk fitur split bill | S1 (stretch) |
| Azure AI Vision/Custom Vision | Pengenalan foto makanan otomatis, roadmap v2 | Roadmap |

### 3.4 Basis Data

Menyimpan data pengguna, riwayat makan, basis data vendor, dan hasil check-in energi/fokus. Untuk MVP, cukup menggunakan basis data terkelola seperti Azure Cosmos DB atau alternatif setara yang tersedia bagi tim.

## 4. Alur Data Utama

### 4.1 Pencatatan makan dan estimasi gizi (F1, F2)

1. Pengguna mengetik makanan yang baru dikonsumsi dalam bahasa sehari-hari.
2. Backend mengirim teks ke Azure OpenAI dengan prompt yang mengarahkan model untuk menghasilkan estimasi gizi terstruktur.
3. Azure OpenAI mengembalikan estimasi dalam format terstruktur (contoh: JSON berisi perkiraan protein, karbohidrat, zat besi, dan estimasi harga).
4. Backend menyimpan hasil ke koleksi meal_logs dan menghitung akumulasi gizi harian pengguna.
5. Backend membandingkan akumulasi dengan kebutuhan harian dan menampilkan kesenjangan gizi ke pengguna.

### 4.2 Rekomendasi lokasi dan menu (F4)

1. Pengguna memasukkan sisa waktu luang dan batas anggaran.
2. Backend mengambil daftar vendor terdekat menggunakan Azure Maps dan basis data vendor.
3. Backend mencocokkan menu vendor dengan kesenjangan gizi pengguna serta batas anggaran dan waktu.
4. Rekomendasi menu dan vendor ditampilkan ke pengguna.

### 4.3 Check-in energi dan fokus (F5)

1. Setelah mencatat makan, pengguna mengisi tingkat energi dan fokus secara singkat.
2. Backend menyimpan data ke koleksi checkins.
3. Setelah data terkumpul beberapa minggu, Azure OpenAI digunakan untuk merangkum pola dalam bahasa natural, disertai disclaimer bahwa ini bukan diagnosis medis.

### 4.4 Split bill via OCR struk (S1, stretch)

1. Pengguna memfoto struk warung.
2. Foto dikirim ke Azure AI Document Intelligence untuk proses OCR.
3. Backend mem-parsing hasil OCR menjadi daftar item dan harga.
4. Pengguna mengonfirmasi item yang menjadi tanggungannya masing-masing.
5. Backend menghitung total tagihan per orang.

## 5. Skema Data (Ringkas)

| Koleksi | Field utama | Keterangan |
|---|---|---|
| users | id, nama, jadwal_kuliah, preferensi_anggaran | Data dasar pengguna |
| meal_logs | id, user_id, teks_input, estimasi_gizi, vendor_id (opsional), waktu | Riwayat catatan makan |
| vendors | id, nama_warung, lokasi, daftar_menu, estimasi_harga | Basis data vendor lokal, diisi manual untuk MVP |
| checkins | id, user_id, meal_log_id, tingkat_energi, tingkat_fokus, waktu | Data check-in setelah makan |

## 6. Keamanan dan Privasi

- Data pribadi seperti riwayat makan dan check-in energi hanya dapat diakses oleh pengguna terkait.
- Tidak ada data individu yang dibagikan ke pihak ketiga dalam bentuk teridentifikasi.
- Data vendor bersifat publik/agregat sehingga aman digunakan untuk analisis lebih lanjut di masa depan.
- Seluruh komunikasi ke layanan Azure menggunakan koneksi terenkripsi (HTTPS/TLS).
- Estimasi gizi dan insight energi/fokus selalu disertai disclaimer bahwa hasil bersifat perkiraan, bukan nasihat medis atau gizi profesional.

## 7. Batasan Teknis MVP vs Roadmap

| Aspek | MVP (semester ini) | Roadmap |
|---|---|---|
| Input makanan | Teks bebas | Foto otomatis (computer vision) |
| Basis data vendor | Diisi manual, 15 sampai 20 warung | Crowdsourcing dari pengguna |
| Rekomendasi lokasi | Berdasarkan basis data statis + Azure Maps | Data real-time dari komunitas |
| Split bill | OCR struk sederhana (stretch) | Integrasi pembayaran langsung |
| Integrasi jadwal kuliah | Input manual oleh pengguna | Integrasi otomatis ke sistem akademik kampus |

## 8. Referensi

Dokumen ini melengkapi brainstorm.md, prd.md, dan lean-canvas.md yang sudah dibuat sebelumnya.
