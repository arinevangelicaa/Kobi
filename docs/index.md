# Kobi

**Project Senior Project TI**

Departemen Teknik Elektro dan Teknologi Informasi, Fakultas Teknik, Universitas Gadjah Mada

---

## Profil Kelompok

**Nama Kelompok:** Kibo

**Anggota:**

| Nama | NIM | Peran |
|---|---|---|
| Adnan Abdul Majid | 24/544058/TK/60471 | Software Engineer, Cloud Engineer, AI Engineer |
| Arin Evangelica Patabang | 24/534030/TK/59182 | Project Manager, Software Engineer |
| Rida Larasati | 24/539400/TK/59821 | UI/UX Designer, Software Engineer |

---

## Tentang Produk

### Nama Produk
Kobi

### Latar Belakang
Mahasiswa dengan kesibukan di perkuliahan sering kesulitan makan dengan gizi seimbang karena keterbatasan waktu, anggaran, dan informasi tentang tempat makan terdekat yang sesuai kebutuhan mereka.

Riset terhadap aplikasi sejenis (BeCute, Bussin, CollegeMacros, Studelicious, PlateLens) menunjukkan bahwa hampir seluruh fitur yang direncanakan sudah tersedia di pasar, namun seluruh kompetitor tersebut dibangun untuk sistem pangan negara maju: kantin dengan menu tetap, supermarket dengan barcode, dan basis data nutrisi resmi. Tidak ada kompetitor yang menangani warung, kaki lima, dan pasar tanpa label gizi atau barcode, transaksi tunai dengan harga informal, jam operasional yang tidak tetap, serta penamaan makanan lokal (contoh: "nasi kucing", "gudeg", "es teh tawar"). Celah inilah yang menjadi dasar Kobi.

### Rumusan Permasalahan
- Bagaimana merancang aplikasi berbasis AI yang membantu mahasiswa dengan jadwal kuliah padat dan anggaran terbatas untuk memahami kesenjangan gizi harian, mengingat aplikasi pelacak gizi yang ada saat ini hanya melayani sistem pangan formal dan tidak menjangkau warung serta kaki lima?
- Bagaimana memberikan rekomendasi tempat makan dan menu terdekat yang sesuai anggaran serta sela waktu luang di antara jadwal kuliah mahasiswa, menggunakan basis data vendor lokal dan layanan lokasi?

### Ide Solusi
Kobi adalah aplikasi berbasis AI yang membantu mahasiswa mencatat pola makan dalam bahasa sehari-hari, menganalisis kesenjangan gizi harian (bukan sekadar hitung kalori), dan menemukan menu bergizi dengan anggaran terbatas dari warung, kaki lima, dan pasar terdekat, disesuaikan dengan sela jadwal kuliah pengguna. Kobi memanfaatkan Azure OpenAI untuk mengubah teks bebas menjadi estimasi gizi terstruktur, Azure Maps untuk rekomendasi lokasi vendor terdekat, serta basis data vendor lokal yang disiapkan manual untuk tahap MVP.

**Rancangan Fitur:**

| Fitur | Keterangan |
|---|---|
| F1 – Pencatatan makan teks bebas | Pengguna mengetik apa yang dimakan dalam bahasa sehari-hari |
| F2 – Estimasi & analisis kesenjangan gizi | AI memperkirakan kandungan gizi dan membandingkan dengan kebutuhan harian |
| F3 – Basis data vendor lokal | Basis data awal 15–20 warung sekitar kampus |
| F4 – Rekomendasi lokasi & waktu | Menyarankan menu dari warung terdekat sesuai sela waktu kuliah |
| F5 – Check-in energi & fokus | Pengguna mencatat energi/fokus setelah makan untuk melihat pola |
| S1 – Split bill via OCR struk (stretch) | Membagi tagihan makan bersama dari foto struk |

### Analisis Kompetitor

**BeCute** — Direct competitor, aplikasi pelacak nutrisi berbasis AI dengan pengenalan foto makanan. Basis data makanannya berbasis toko/supermarket berbarcode dan tidak mengenali menu warung atau kaki lima.

**Bussin** — Indirect competitor, asisten AI perencanaan belanja dan makan mahasiswa. Berasumsi pengguna memasak sendiri, tidak melayani mahasiswa yang membeli makan jadi dari warung.

**CollegeMacros** — Direct competitor, aplikasi pelacakan nutrisi khusus mahasiswa berfokus pada kantin kampus. Tidak mencakup warung/kaki lima di luar kampus dan masih berbasis hitung kalori.

Kobi membedakan diri dengan menerima input teks bebas untuk makanan warung tanpa label gizi, mencakup basis data vendor informal yang tidak dijangkau kompetitor, dan menggunakan pendekatan kesenjangan gizi (bukan hitung kalori) sebagai pertimbangan etis.
