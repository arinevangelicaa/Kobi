# PRD: Kobi

**Product Requirements Document**
**Versi:** 1.0 (Draf proyek kuliah)
**Nama produk:** Kobi

## 1. Ringkasan Produk

Kobi adalah aplikasi berbasis AI yang membantu mahasiswa mencatat pola makan, memahami kesenjangan gizi harian, dan menemukan makanan bergizi dengan anggaran terbatas dari warung, kaki lima, dan pasar terdekat, disesuaikan dengan jadwal kuliah mereka. Berbeda dari aplikasi pelacak kalori yang sudah ada di pasar (BeCute, Bussin, CollegeMacros, dan sejenisnya), Kobi dirancang khusus untuk ekonomi pangan informal yang tidak dilayani oleh aplikasi-aplikasi tersebut.

## 2. Latar Belakang dan Masalah

Mahasiswa sering mengalami pola makan tidak teratur karena jadwal kuliah yang padat, keterbatasan anggaran, dan minimnya informasi tentang pilihan makanan bergizi di sekitar tempat tinggal atau kampus. Aplikasi pelacak gizi yang ada saat ini dibangun untuk sistem pangan formal (kantin, supermarket berbarcode) dan tidak berfungsi baik untuk makanan warung atau kaki lima yang menjadi sumber makan utama mahasiswa Indonesia.

## 3. Tujuan Produk

- Membantu mahasiswa memahami kesenjangan gizi harian tanpa mendorong fiksasi terhadap angka kalori.
- Memberikan rekomendasi tempat makan terdekat yang sesuai anggaran dan waktu luang di antara jadwal kuliah.
- Membangun basis data gizi untuk makanan informal Indonesia yang saat ini belum tersedia secara terbuka.

## 4. Metrik Keberhasilan

- Jumlah entri makan tercatat per pengguna per minggu (target uji coba: rata-rata 10 entri per minggu selama masa uji).
- Tingkat akurasi estimasi gizi dibanding penilaian manual pada sampel uji, didokumentasikan apa adanya, tidak diklaim sempurna.
- Umpan balik kualitatif dari pengguna uji terhadap fitur check-in energi dan fokus.

## 5. Target Pengguna

**Persona utama:** Mahasiswa S1, usia 18 sampai 24 tahun, tinggal di kos atau dekat kampus, jadwal kuliah padat, anggaran makan terbatas, terbiasa membeli makan di warung atau kaki lima, bukan memasak sendiri.

## 6. Ruang Lingkup

### 6.1 MVP (dibangun dan didemokan semester ini)

| ID | Fitur | Deskripsi |
|---|---|---|
| F1 | Pencatatan makan teks bebas | Pengguna mengetik apa yang dimakan dalam bahasa sehari-hari, contoh: "nasi telur dan es teh dari warung deket kost" |
| F2 | Estimasi dan analisis kesenjangan gizi | Model AI (Azure OpenAI melalui Microsoft Foundry) memperkirakan kandungan gizi dan membandingkannya dengan kebutuhan harian, menampilkan kekurangan seperti protein atau zat besi, bukan hitungan kalori |
| F3 | Basis data vendor lokal | Basis data awal berisi 15 sampai 20 warung di sekitar kampus, disiapkan manual untuk tahap ini, lengkap dengan perkiraan menu dan harga |
| F4 | Rekomendasi lokasi dan waktu | Menyarankan menu spesifik dari warung terdekat yang menutup kesenjangan gizi, memperhitungkan sisa waktu luang antar jadwal kuliah, menggunakan Azure Maps untuk jarak dan lokasi |
| F5 | Check-in energi dan fokus | Setelah mencatat makan, pengguna mengisi tingkat energi dan fokus secara singkat, setelah beberapa minggu aplikasi menampilkan pola dalam bahasa sederhana tanpa klaim medis |

### 6.2 Stretch goal

| ID | Fitur | Deskripsi |
|---|---|---|
| S1 | Split bill via OCR struk | Foto struk tulisan tangan warung diproses dengan Azure AI Document Intelligence untuk membagi tagihan sesuai pesanan masing-masing saat makan bersama |

### 6.3 Roadmap (di luar cakupan proyek ini)

- Pencatatan makan bersama secara sosial/real-time
- Pengenalan foto makanan otomatis (computer vision), membutuhkan dataset yang belum ada
- Crowdsourcing data vendor skala besar dari pengguna
- Lisensi data agregat ke pihak ketiga, seperti dinas kesehatan atau platform pesan-antar, sebagai model bisnis lanjutan

## 7. Kebutuhan Fungsional

- Sistem harus dapat menerima input teks bebas berbahasa Indonesia dan menghasilkan estimasi gizi dalam waktu wajar, target di bawah 5 detik untuk keperluan demo.
- Sistem harus menyimpan riwayat makan per pengguna dan menghitung akumulasi gizi harian.
- Sistem harus dapat mencocokkan lokasi pengguna dengan basis data vendor terdekat dan menyaring berdasarkan anggaran yang ditentukan pengguna.
- Sistem harus menampilkan disclaimer bahwa estimasi bersifat perkiraan, bukan nasihat medis atau gizi profesional.

## 8. Kebutuhan Non-Fungsional

- **Privasi data:** data makan dan check-in energi bersifat pribadi, tidak dibagikan dalam bentuk teridentifikasi ke pihak ketiga mana pun; hanya data agregat/anonim dari sisi vendor yang berpotensi digunakan untuk model bisnis lanjutan di masa depan.
- **Bahasa:** antarmuka dan interaksi AI menggunakan Bahasa Indonesia sebagai bahasa utama.
- **Aksesibilitas data:** aplikasi dirancang ringan dari sisi penggunaan data, mengingat sebagian mahasiswa memiliki keterbatasan kuota internet.
- **Keandalan estimasi:** akurasi estimasi gizi harus didokumentasikan secara jujur, bukan diklaim akurat sepenuhnya, mengingat tidak ada basis data resmi untuk makanan informal.

## 9. Arsitektur Teknis (Ringkas)

- **Azure OpenAI (Microsoft Foundry):** memproses input teks bebas menjadi estimasi gizi terstruktur, dan menghasilkan insight pola energi/fokus dalam bahasa natural.
- **Azure AI Document Intelligence:** fitur stretch, membaca struk warung untuk fitur split bill.
- **Azure Maps:** menghitung jarak dan estimasi waktu tempuh ke vendor terdekat.
- **Basis data** (contoh: Azure Cosmos DB atau setara): menyimpan data pengguna, riwayat makan, dan basis data vendor.
- **Roadmap v2, Azure AI Vision/Custom Vision:** pengenalan foto makanan otomatis, membutuhkan pengumpulan dataset foto makanan informal terlebih dahulu.

## 10. Alur Pengguna Utama

1. Pengguna membuka aplikasi dan mencatat makanan yang baru dikonsumsi dalam teks bebas.
2. Aplikasi menampilkan estimasi gizi dan kesenjangan gizi harian saat itu.
3. Aplikasi menanyakan tingkat energi dan fokus pengguna secara singkat.
4. Jika ada celah waktu di jadwal kuliah pengguna, aplikasi menyarankan menu dan warung terdekat yang menutup kesenjangan gizi dalam anggaran yang ditentukan.
5. Pengguna dapat melihat pola mingguan dari riwayat makan dan check-in energi/fokus.

## 11. Batasan dan Asumsi

- Basis data vendor pada tahap ini disiapkan manual, bukan hasil crowdsourcing otomatis.
- Estimasi gizi bersifat perkiraan berbasis pengetahuan umum model AI, bukan hasil uji laboratorium.
- Aplikasi mengasumsikan pengguna bersedia memberikan input jadwal kuliah secara manual, tanpa integrasi otomatis ke sistem akademik kampus pada tahap ini.

## 12. Pertimbangan Etis dan Desain

Aplikasi pelacak kalori memiliki catatan literatur terkait potensi memicu fiksasi dan pola makan tidak sehat pada sebagian pengguna. Kobi secara sengaja tidak menonjolkan angka kalori sebagai metrik utama, melainkan kesenjangan gizi dan kesesuaian anggaran, disertai disclaimer yang jelas bahwa aplikasi ini bukan pengganti konsultasi ahli gizi.

## 13. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Akurasi estimasi gizi rendah untuk makanan informal tanpa data resmi | Rekomendasi kurang tepat | Uji dengan sampel terbatas, dokumentasikan tingkat akurasi secara jujur |
| Basis data vendor manual sulit di-scale | Cakupan rekomendasi terbatas pada area sekitar kampus | Jelaskan sebagai batasan tahap awal, crowdsourcing menjadi roadmap |
| Ketergantungan pada input jadwal manual | Fitur rekomendasi proaktif kurang otomatis | Sediakan opsi input manual sebagai solusi sementara |

## 14. Referensi Kompetitor

Lihat brainstorm.md untuk analisis kompetitor lengkap.
