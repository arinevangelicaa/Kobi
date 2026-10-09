/**
 * Perhitungan target kebutuhan gizi harian berdasarkan data profil fisik pengguna.
 * Sesuai docs/architecture.md bagian 10 langkah 1.
 *
 * Menggunakan formula standar Mifflin-St Jeor dan Angka Kecukupan Gizi (AKG) Indonesia.
 */

export interface ProfilFisik {
  tanggal_lahir?: Date | string | null;
  jenis_kelamin?: string | null; // "L" | "P" | "laki-laki" | "perempuan"
  berat_badan_kg?: number | null;
  tinggi_badan_cm?: number | null;
}

export interface TargetGiziHasil {
  kalori_target: number;
  protein_target_g: number;
  karbohidrat_target_g: number;
  lemak_target_g: number;
  zat_besi_target_mg: number;
}

/**
 * Menghitung usia pengguna dalam tahun penuh berdasarkan tanggal lahir.
 * Default 20 tahun jika tanggal lahir tidak diisi (usia rata-rata mahasiswa).
 */
export function hitungUsia(tanggalLahir?: Date | string | null, tanggalAcuan = new Date()): number {
  if (!tanggalLahir) return 20;

  const lahir = typeof tanggalLahir === "string" ? new Date(tanggalLahir) : tanggalLahir;
  if (isNaN(lahir.getTime())) return 20;

  let usia = tanggalAcuan.getFullYear() - lahir.getFullYear();
  const m = tanggalAcuan.getMonth() - lahir.getMonth();
  if (m < 0 || (m === 0 && tanggalAcuan.getDate() < lahir.getDate())) {
    usia--;
  }

  return Math.max(15, Math.min(usia, 80));
}

/**
 * Menghitung estimasi target nutrisi harian berdasarkan profil fisik.
 */
export function hitungTargetGizi(profil: ProfilFisik, tanggalAcuan = new Date()): TargetGiziHasil {
  const bb = profil.berat_badan_kg && profil.berat_badan_kg > 0 ? profil.berat_badan_kg : 60;
  const tb = profil.tinggi_badan_cm && profil.tinggi_badan_cm > 0 ? profil.tinggi_badan_cm : 165;
  const usia = hitungUsia(profil.tanggal_lahir, tanggalAcuan);

  const jk = (profil.jenis_kelamin ?? "L").toUpperCase();
  const isWanita = jk === "P" || jk === "PEREMPUAN";

  // Formula Mifflin-St Jeor untuk Basal Metabolic Rate (BMR)
  let bmr = 10 * bb + 6.25 * tb - 5 * usia;
  if (isWanita) {
    bmr -= 161;
  } else {
    bmr += 5;
  }

  // Faktor aktivitas fisik mahasiswa (aktivitas ringan / kuliah-kampus = 1.375)
  const tdee = bmr * 1.375;
  const kaloriTarget = Math.round(tdee);

  // Kebutuhan protein: 1.2 g per kg berat badan (atau minimal 15% dari kalori)
  const proteinGram = Math.round(Math.max(bb * 1.2, (kaloriTarget * 0.15) / 4));

  // Lemak: 25% dari total kalori (1 gram lemak = 9 kkal)
  const lemakGram = Math.round((kaloriTarget * 0.25) / 9);

  // Karbohidrat: sisa kalori (sekitar 55-60%, 1 gram karbohidrat = 4 kkal)
  const kaloriSisaKarbo = Math.max(kaloriTarget - (proteinGram * 4 + lemakGram * 9), 0);
  const karbohidratGram = Math.round(kaloriSisaKarbo / 4);

  // Zat besi harian berdasarkan AKG Indonesia mahasiswa 18-24 tahun
  // Wanita membutuhkan lebih banyak zat besi (~18 mg) dibanding pria (~11 mg)
  const zatBesiMg = isWanita ? 18 : 11;

  return {
    kalori_target: kaloriTarget,
    protein_target_g: proteinGram,
    karbohidrat_target_g: karbohidratGram,
    lemak_target_g: lemakGram,
    zat_besi_target_mg: zatBesiMg,
  };
}
