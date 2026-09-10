# Brainstorm Proyek: Kobi

*Aplikasi gizi berbasis AI untuk mahasiswa, disesuaikan dengan ekonomi pangan informal Indonesia*

## 1. Latar Belakang Masalah

Mahasiswa dengan jadwal kuliah padat sering kesulitan makan dengan gizi seimbang karena keterbatasan waktu, anggaran, dan informasi tentang tempat makan terdekat yang sesuai kebutuhan mereka. Masalah ini nyata dan berulang, bukan sekadar asumsi teoretis.

## 2. Riset Kompetitor

Sebelum menentukan arah proyek, dilakukan pencarian terhadap aplikasi sejenis yang sudah ada di pasar (per Agustus 2026):

| Aplikasi | Fitur utama | Sumber |
|---|---|---|
| BeCute | Pengenalan foto makanan via AI, perbandingan harga toko lokal, rencana makan sesuai jadwal dan anggaran | becute.app |
| Bussin | Asisten AI "Brokie", pemindai kulkas, daftar belanja per bagian toko, perencanaan mingguan berbasis anggaran | App Store |
| CollegeMacros | Pelacakan nutrisi AI khusus mahasiswa, fokus kantin kampus | collegemacros.com |
| Studelicious | Perencanaan makan hemat, integrasi kalender kuliah | studelicious.com |
| PlateLens | Akurasi pengenalan foto makanan sekitar 1.2% MAPE pada makanan kantin | bestcalorieapps.com |

**Temuan penting:** hampir seluruh fitur yang awalnya direncanakan (pencatatan makan, estimasi kalori/gizi, rekomendasi, pelacakan lokasi toko terdekat) sudah tersedia di produk-produk di atas. Ide awal (pelacak kalori umum untuk mahasiswa) tidak orisinal dan berisiko dinilai sebagai duplikasi tanpa kontribusi baru.

## 3. Celah yang Ditemukan

Seluruh kompetitor di atas dibangun untuk sistem pangan negara maju: kantin dengan menu tetap, supermarket dengan barcode, dan basis data nutrisi resmi. Tidak ada yang menangani:

- Warung, kaki lima, dan pasar tanpa label gizi atau barcode
- Transaksi tunai, harga informal/negotiable
- Jam operasional tidak tetap
- Penamaan makanan lokal (contoh: "nasi kucing", "gudeg", "es teh tawar")

Ini menjadi celah pasar yang belum digarap, sekaligus tantangan teknis nyata karena tidak ada basis data nutrisi siap pakai untuk makanan informal Indonesia.

## 4. Evolusi Ide

1. **Versi awal:** pelacak kalori umum dengan rekomendasi lokasi beli makanan terdekat.
2. **Setelah riset kompetitor:** ide dianggap terlalu jenuh (saturated), hampir seluruh fitur sudah ada di pasar.
3. **Pivot pertama:** fokus ke ekonomi pangan informal Indonesia (warung, kaki lima) yang tidak dilayani kompetitor manapun.
4. **Pivot kedua (framing):** mengganti pendekatan "hitung kalori" menjadi "analisis kesenjangan gizi dan anggaran" (nutrient-gap, bukan calorie-counting), karena pendekatan hitung kalori memiliki catatan literatur terkait potensi memicu pola makan tidak sehat pada pengguna rentan.
5. **Penambahan fitur lanjutan:** ditambahkan dua arah fitur, yaitu korelasi energi/fokus dengan pola makan, dan fitur sosial makan bareng dengan split bill otomatis.

## 5. Daftar Fitur yang Dipertimbangkan

| Fitur | Kategori | Alasan |
|---|---|---|
| Pencatatan makan via teks bebas | MVP | Lebih realistis untuk makanan informal dibanding database barcode |
| Estimasi dan analisis kesenjangan gizi (bukan kalori) | MVP | Diferensiasi utama, sekaligus keputusan etis |
| Basis data vendor lokal (warung sekitar kampus) | MVP | Fondasi dari seluruh fitur rekomendasi lokasi |
| Rekomendasi lokasi dan waktu (celah jadwal kuliah) | MVP | Mengubah pencatatan pasif menjadi rekomendasi proaktif |
| Check-in energi dan fokus harian | MVP | Menjawab kebutuhan mahasiswa spesifik, bukan sekadar target berat badan |
| Split bill via OCR struk tulisan tangan | Stretch | Fitur AI yang nyata (Document Intelligence), sekaligus mendorong pertumbuhan organik |
| Pencatatan makan bersama (sosial) | Stretch/Roadmap | Butuh basis pengguna dulu agar bermanfaat |
| Pengenalan foto makanan (computer vision) | Roadmap v2 | Butuh dataset foto makanan informal yang belum ada, terlalu berat untuk satu semester |
| Crowdsourcing data vendor skala besar | Roadmap | Butuh basis pengguna aktif dulu |
| Lisensi data ke pihak ketiga (dinas kesehatan, platform pesan-antar) | Roadmap, model bisnis jangka panjang | Butuh volume data yang cukup dulu |

## 6. Fitur yang Sengaja Tidak Dipilih untuk Semester Ini

- **Pengenalan foto otomatis:** akurasi butuh dataset besar yang belum ada untuk makanan informal Indonesia, risiko akurasi rendah jika dipaksakan dalam waktu terbatas.
- **Transaksi/pemesanan dalam aplikasi:** di luar cakupan riset produk, menambah kompleksitas legal dan teknis yang tidak perlu untuk membuktikan konsep.
- **Crowdsourcing skala besar saat peluncuran:** butuh basis pengguna yang belum tentu ada di tahap proyek kuliah, akan didemokan dengan data yang di-seed manual (15 sampai 20 warung).

## 7. Pertimbangan Etis

Aplikasi pelacak kalori memiliki catatan literatur terkait potensi memperkuat fiksasi dan pola makan tidak sehat pada sebagian pengguna. Keputusan desain: aplikasi ini tidak menampilkan angka kalori yang menyusut sebagai metrik utama, melainkan kesenjangan gizi (protein, zat besi, dan sebagainya) dan kesesuaian anggaran. Semua estimasi ditandai sebagai perkiraan, bukan diagnosis medis, dan aplikasi menyertakan disclaimer yang jelas.

## 8. Sumber Riset Kompetitor

- https://becute.app
- https://studelicious.com
- https://www.collegemacros.com
- https://bestcalorieapps.com/en/articles/best-calorie-tracking-apps-for-college-students-2026/
