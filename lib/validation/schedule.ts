import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const scheduleCreateSchema = z
  .object({
    mata_kuliah: z.string().trim().min(1, "Nama mata kuliah tidak boleh kosong.").max(150),
    hari: z
      .number()
      .int()
      .min(1, "Hari harus bernilai 1 (Senin) sampai 7 (Minggu).")
      .max(7, "Hari harus bernilai 1 (Senin) sampai 7 (Minggu)."),
    jam_mulai: z.string().regex(timeRegex, "Format jam mulai harus HH:MM (contoh: 07:30)."),
    jam_selesai: z.string().regex(timeRegex, "Format jam selesai harus HH:MM (contoh: 09:10)."),
    lokasi_ruang: z.string().trim().max(100).optional().nullable(),
  })
  .refine(
    (data) => {
      return data.jam_mulai < data.jam_selesai;
    },
    {
      message: "Jam mulai harus lebih awal daripada jam selesai.",
      path: ["jam_mulai"],
    },
  );

export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>;
