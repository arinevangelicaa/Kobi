import { prisma } from "@/lib/db";
import { rentangHariWIB } from "@/lib/time-wib";

export type StatistikProfil = { total: number; beruntun: number };

export async function dapatkanStatistikProfil(userId: string): Promise<StatistikProfil> {
  const { tanggal } = rentangHariWIB();
  const [statistik] = await prisma.$queryRaw<StatistikProfil[]>`
    WITH harian AS (
      SELECT (waktu_makan AT TIME ZONE 'Asia/Jakarta')::date AS hari, count(*) AS jumlah
      FROM meal_logs
      WHERE user_id = ${userId}::uuid
      GROUP BY 1
    ), urutan AS (
      SELECT hari, row_number() OVER (ORDER BY hari DESC)::int AS posisi
      FROM harian
      WHERE hari <= ${tanggal}::date
    )
    SELECT
      COALESCE((SELECT sum(jumlah) FROM harian), 0)::int AS total,
      (SELECT count(*) FROM urutan
        WHERE hari + posisi = (SELECT max(hari) + 1 FROM urutan)
          AND (SELECT max(hari) FROM urutan) >= ${tanggal}::date - 1)::int AS beruntun
  `;
  return statistik;
}
