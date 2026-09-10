import { NextResponse } from "next/server";

/**
 * Endpoint kesehatan untuk App Service dan pemeriksaan setelah deploy.
 * Tidak menyentuh basis data supaya tetap murah dipanggil berulang.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "kobi",
    waktu: new Date().toISOString(),
  });
}
