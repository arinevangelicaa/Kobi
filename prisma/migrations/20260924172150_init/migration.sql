-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "nama" TEXT NOT NULL,
    "tanggal_lahir" DATE,
    "jenis_kelamin" TEXT,
    "berat_badan_kg" DECIMAL(5,2),
    "tinggi_badan_cm" DECIMAL(5,2),
    "preferensi_anggaran" INTEGER,
    "dibuat_pada" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_schedules" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mata_kuliah" TEXT NOT NULL,
    "hari" SMALLINT NOT NULL,
    "jam_mulai" TIME(6) NOT NULL,
    "jam_selesai" TIME(6) NOT NULL,
    "lokasi_ruang" TEXT,

    CONSTRAINT "class_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_targets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kalori_target" INTEGER NOT NULL,
    "protein_target_g" DECIMAL(6,2) NOT NULL,
    "karbohidrat_target_g" DECIMAL(6,2) NOT NULL,
    "lemak_target_g" DECIMAL(6,2) NOT NULL,
    "zat_besi_target_mg" DECIMAL(6,2) NOT NULL,
    "berlaku_sejak" DATE NOT NULL,

    CONSTRAINT "nutrition_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vendor_id" UUID,
    "teks_input" TEXT NOT NULL,
    "sumber_makanan" TEXT,
    "total_harga" INTEGER,
    "waktu_makan" TIMESTAMPTZ(6) NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_estimates" (
    "id" UUID NOT NULL,
    "meal_log_id" UUID NOT NULL,
    "kalori_estimasi" INTEGER NOT NULL,
    "protein_g" DECIMAL(6,2) NOT NULL,
    "karbohidrat_g" DECIMAL(6,2) NOT NULL,
    "lemak_g" DECIMAL(6,2) NOT NULL,
    "zat_besi_mg" DECIMAL(6,2) NOT NULL,
    "tingkat_keyakinan" DECIMAL(3,2) NOT NULL,
    "model_versi" TEXT NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nutrition_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkins" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "meal_log_id" UUID NOT NULL,
    "tingkat_energi" SMALLINT NOT NULL,
    "tingkat_fokus" SMALLINT NOT NULL,
    "catatan" TEXT,
    "waktu" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "nama_warung" TEXT NOT NULL,
    "jenis_vendor" TEXT,
    "alamat" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "jam_buka" TIME(6),
    "jam_tutup" TIME(6),
    "diverifikasi_pada" DATE,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "nama_menu" TEXT NOT NULL,
    "estimasi_harga" INTEGER NOT NULL,
    "estimasi_kalori" INTEGER,
    "estimasi_protein_g" DECIMAL(6,2),
    "tersedia" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "gizi_disasar" TEXT NOT NULL,
    "batas_anggaran" INTEGER NOT NULL,
    "sela_waktu_menit" INTEGER NOT NULL,
    "jarak_meter" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ditampilkan',
    "waktu_dibuat" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vendor_id" UUID,
    "url_gambar" TEXT NOT NULL,
    "total_tagihan" INTEGER,
    "status_ocr" TEXT NOT NULL DEFAULT 'menunggu',
    "waktu_unggah" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_items" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "nama_item" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL DEFAULT 1,
    "harga_satuan" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,

    CONSTRAINT "receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_shares" (
    "id" UUID NOT NULL,
    "receipt_item_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "porsi" DECIMAL(4,2) NOT NULL,
    "jumlah_bayar" INTEGER NOT NULL,
    "status_bayar" TEXT NOT NULL DEFAULT 'belum',

    CONSTRAINT "bill_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "class_schedules_user_id_hari_idx" ON "class_schedules"("user_id", "hari");

-- CreateIndex
CREATE INDEX "nutrition_targets_user_id_berlaku_sejak_idx" ON "nutrition_targets"("user_id", "berlaku_sejak");

-- CreateIndex
CREATE INDEX "meal_logs_user_id_waktu_makan_idx" ON "meal_logs"("user_id", "waktu_makan" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "nutrition_estimates_meal_log_id_key" ON "nutrition_estimates"("meal_log_id");

-- CreateIndex
CREATE UNIQUE INDEX "checkins_meal_log_id_key" ON "checkins"("meal_log_id");

-- CreateIndex
CREATE INDEX "checkins_user_id_waktu_idx" ON "checkins"("user_id", "waktu" DESC);

-- CreateIndex
CREATE INDEX "vendors_latitude_longitude_idx" ON "vendors"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "menu_items_vendor_id_estimasi_harga_idx" ON "menu_items"("vendor_id", "estimasi_harga");

-- CreateIndex
CREATE INDEX "recommendations_user_id_waktu_dibuat_idx" ON "recommendations"("user_id", "waktu_dibuat" DESC);

-- CreateIndex
CREATE INDEX "receipts_user_id_waktu_unggah_idx" ON "receipts"("user_id", "waktu_unggah" DESC);

-- CreateIndex
CREATE INDEX "receipt_items_receipt_id_idx" ON "receipt_items"("receipt_id");

-- CreateIndex
CREATE UNIQUE INDEX "bill_shares_receipt_item_id_user_id_key" ON "bill_shares"("receipt_item_id", "user_id");

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_targets" ADD CONSTRAINT "nutrition_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_estimates" ADD CONSTRAINT "nutrition_estimates_meal_log_id_fkey" FOREIGN KEY ("meal_log_id") REFERENCES "meal_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_meal_log_id_fkey" FOREIGN KEY ("meal_log_id") REFERENCES "meal_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_shares" ADD CONSTRAINT "bill_shares_receipt_item_id_fkey" FOREIGN KEY ("receipt_item_id") REFERENCES "receipt_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_shares" ADD CONSTRAINT "bill_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
