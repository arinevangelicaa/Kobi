#!/usr/bin/env bash
# Menjalankan tes integrasi (tests/integration) terhadap Postgres sementara di
# Docker: nyalakan kontainer, tunggu siap, `prisma migrate deploy`, jalankan
# vitest, lalu hentikan kontainer (juga bila tes gagal atau dibatalkan).
#
# DATABASE_URL di sini HANYA untuk basis data uji yang dibuat skrip ini. Nilai
# DATABASE_URL pengembang dan berkas .env tidak pernah dipakai atau disentuh.
#
# Pemakaian:
#   scripts/test-integration.sh [argumen vitest, mis. -t "check-in"]
#
# Variabel opsional:
#   INTEGRATION_DB_PORT  port host (default 54329, sengaja bukan 5432)
#   INTEGRATION_DB_IMAGE image Postgres (default postgres:16, sama dengan CI)
#   CONTAINER_CLI        docker (default) atau podman
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

CLI="${CONTAINER_CLI:-docker}"
PORT="${INTEGRATION_DB_PORT:-54329}"
IMAGE="${INTEGRATION_DB_IMAGE:-postgres:16}"
NAMA="kobi-integration-pg-$$"
DB_USER="kobi"
DB_PASS="kobi_test"
DB_NAME="kobi_test"

if ! command -v "$CLI" >/dev/null 2>&1; then
  echo "Perintah '$CLI' tidak ditemukan. Pasang Docker atau set CONTAINER_CLI=podman." >&2
  exit 1
fi
if ! "$CLI" info >/dev/null 2>&1; then
  echo "Daemon '$CLI' tidak dapat diakses. Nyalakan Docker lebih dulu." >&2
  exit 1
fi

bersihkan() {
  "$CLI" rm -f "$NAMA" >/dev/null 2>&1 || true
}
trap bersihkan EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "==> Menyalakan Postgres uji ($IMAGE) di 127.0.0.1:$PORT sebagai $NAMA"
"$CLI" run -d --name "$NAMA" \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="$DB_PASS" \
  -e POSTGRES_DB="$DB_NAME" \
  -p "127.0.0.1:${PORT}:5432" \
  "$IMAGE" >/dev/null

echo "==> Menunggu Postgres siap"
siap=0
for _ in $(seq 1 60); do
  # Lewat TCP (-h 127.0.0.1): server sementara saat inisialisasi hanya
  # mendengarkan soket unix, jadi pemeriksaan ini tidak lolos terlalu dini.
  if "$CLI" exec "$NAMA" pg_isready -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    siap=1
    break
  fi
  sleep 1
done
if [ "$siap" -ne 1 ]; then
  echo "Postgres tidak siap dalam 60 detik. Log kontainer:" >&2
  "$CLI" logs "$NAMA" >&2 || true
  exit 1
fi

export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:${PORT}/${DB_NAME}"

echo "==> prisma migrate deploy"
npx prisma migrate deploy

echo "==> vitest (tes integrasi)"
npx vitest run --config vitest.integration.config.ts "$@"
