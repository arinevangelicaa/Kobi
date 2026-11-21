/**
 * Hook startup Next.js (dipanggil sekali per instance server).
 *
 * Stub untuk Application Insights (docs/architecture.md bagian 15). Paket
 * `@azure/monitor-opentelemetry` sengaja belum menjadi dependensi; saat tim
 * memasangnya, panggil `useAzureMonitor()` di cabang bertanda TODO di bawah.
 */
export async function register() {
  // Hanya runtime Node.js; Edge tidak punya logger/AsyncLocalStorage kita.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (!process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) return;

  // Import dinamis supaya logger tidak ikut dimuat di jalur yang tidak perlu.
  const { logger } = await import("@/lib/logger");

  // TODO: pasang `@azure/monitor-opentelemetry` lalu panggil
  // `useAzureMonitor({ azureMonitorExporterOptions: { connectionString } })`.
  logger.warn(
    "APPLICATIONINSIGHTS_CONNECTION_STRING terisi, tetapi paket @azure/monitor-opentelemetry belum terpasang; telemetri Application Insights belum aktif.",
  );
}
