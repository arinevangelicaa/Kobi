#!/usr/bin/env bash
# Provisioning infrastruktur Kobi ke Azure lewat az CLI + Bicep.
#
# STATUS: BELUM DIUJI. Skrip ini belum pernah dijalankan karena `az` belum
# terpasang dan belum ada subscription. Hanya sintaks bash yang dicek
# (`bash -n`). Baca infra/README.md sebelum memakainya.
#
# Tidak ada secret di berkas ini. Secret dibaca dari environment variable dan
# diteruskan ke az lewat berkas parameter sementara (mode 600, dihapus saat
# keluar), bukan lewat argumen baris perintah yang terlihat di `ps`.
#
# Contoh:
#   export KOBI_PG_ADMIN_PASSWORD="$(openssl rand -base64 24)"
#   export KOBI_AUTH_SECRET="$(openssl rand -base64 32)"
#   ./infra/deploy.sh -g rg-kobi-prod -l southeastasia --what-if
#   ./infra/deploy.sh -g rg-kobi-prod -l southeastasia \
#       -p openAiLocation=eastus2 -p allowedClientIps='["203.0.113.7"]'
set -euo pipefail

usage() {
  cat <<'USAGE'
Pemakaian: infra/deploy.sh -g <resource-group> -l <location> [opsi]

Wajib:
  -g, --resource-group NAMA   Resource group (dibuat bila belum ada)
  -l, --location REGION       Region utama, mis. southeastasia

Opsi:
  -p, --param KEY=VALUE       Parameter Bicep non-secret tambahan (boleh diulang),
                              mis. -p openAiLocation=eastus2
                                   -p openAiModelName=gpt-4o-mini
                                   -p deployOpenAiModel=false
                                   -p allowedClientIps='["203.0.113.7"]'
      --what-if               Hanya tampilkan perubahan, jangan buat apa pun
                              (resource group tetap dibuat bila belum ada)
  -h, --help                  Tampilkan bantuan ini

Environment variable (wajib, tidak pernah dibaca dari berkas):
  KOBI_PG_ADMIN_PASSWORD      Password admin PostgreSQL
  KOBI_AUTH_SECRET            AUTH_SECRET (Auth.js). Simpan nilainya; mengganti
                              nilai ini membatalkan semua sesi login.
USAGE
}

die() {
  echo "galat: $*" >&2
  exit 1
}

resource_group=""
location=""
what_if=false
extra_params=()

while [ $# -gt 0 ]; do
  case "$1" in
    -g|--resource-group) [ $# -ge 2 ] || die "$1 butuh nilai"; resource_group="$2"; shift 2 ;;
    -l|--location)       [ $# -ge 2 ] || die "$1 butuh nilai"; location="$2"; shift 2 ;;
    -p|--param)          [ $# -ge 2 ] || die "$1 butuh nilai"; extra_params+=("$2"); shift 2 ;;
    --what-if)           what_if=true; shift ;;
    -h|--help)           usage; exit 0 ;;
    *)                   usage >&2; die "argumen tidak dikenal: $1" ;;
  esac
done

[ -n "$resource_group" ] || { usage >&2; die "--resource-group wajib"; }
[ -n "$location" ] || { usage >&2; die "--location wajib"; }

# Secret tidak boleh lewat argumen. Cegah juga bila ada yang menyelipkannya
# lewat -p.
for p in "${extra_params[@]+"${extra_params[@]}"}"; do
  case "$p" in
    pgAdminPassword=*|authSecret=*)
      die "isi secret lewat KOBI_PG_ADMIN_PASSWORD / KOBI_AUTH_SECRET, bukan -p" ;;
  esac
done

: "${KOBI_PG_ADMIN_PASSWORD:?set KOBI_PG_ADMIN_PASSWORD}"
: "${KOBI_AUTH_SECRET:?set KOBI_AUTH_SECRET}"

# Berkas parameter dibangun dengan printf, jadi batasi karakter ke himpunan
# aman (cakupan keluaran `openssl rand -base64`, ditambah . _ -). Dengan begitu
# tidak ada karakter yang perlu di-escape di JSON.
secret_charset='^[A-Za-z0-9+/=._-]+$'
[[ "$KOBI_PG_ADMIN_PASSWORD" =~ $secret_charset ]] \
  || die "KOBI_PG_ADMIN_PASSWORD hanya boleh berisi A-Z a-z 0-9 + / = . _ -"
[[ "$KOBI_AUTH_SECRET" =~ $secret_charset ]] \
  || die "KOBI_AUTH_SECRET hanya boleh berisi A-Z a-z 0-9 + / = . _ -"
[ "${#KOBI_PG_ADMIN_PASSWORD}" -ge 16 ] || die "KOBI_PG_ADMIN_PASSWORD minimal 16 karakter"
[ "${#KOBI_AUTH_SECRET}" -ge 32 ] || die "KOBI_AUTH_SECRET minimal 32 karakter"

command -v az >/dev/null 2>&1 || die "az CLI belum terpasang (https://learn.microsoft.com/cli/azure/install-azure-cli)"
az account show >/dev/null 2>&1 || die "belum login; jalankan 'az login' dan 'az account set --subscription <id>'"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
template="$script_dir/main.bicep"
[ -f "$template" ] || die "tidak menemukan $template"

secrets_file="$(mktemp)"
chmod 600 "$secrets_file"
trap 'rm -f "$secrets_file"' EXIT

printf '{"$schema":"https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#","contentVersion":"1.0.0.0","parameters":{"pgAdminPassword":{"value":"%s"},"authSecret":{"value":"%s"}}}' \
  "$KOBI_PG_ADMIN_PASSWORD" "$KOBI_AUTH_SECRET" > "$secrets_file"

param_args=(--parameters "@$secrets_file")
for p in "${extra_params[@]+"${extra_params[@]}"}"; do
  param_args+=(--parameters "$p")
done

echo "==> Kompilasi Bicep (validasi sintaks dan tipe)"
az bicep build --file "$template" --stdout >/dev/null

echo "==> Memastikan resource group $resource_group ($location)"
az group create --name "$resource_group" --location "$location" --output none

# Pada deployment dengan parameter yang berubah, pakai nama deployment unik
# supaya riwayat tidak saling menimpa.
deployment_name="kobi-infra-$(date -u +%Y%m%d%H%M%S)"
common=(--resource-group "$resource_group" --name "$deployment_name" --template-file "$template" --parameters "location=$location")

echo "==> Validasi deployment di sisi Azure"
az deployment group validate "${common[@]}" "${param_args[@]}" --output none

if [ "$what_if" = true ]; then
  echo "==> what-if (tidak ada perubahan yang diterapkan)"
  az deployment group what-if "${common[@]}" "${param_args[@]}"
  exit 0
fi

echo "==> Menerapkan deployment $deployment_name (PostgreSQL biasanya 5-10 menit)"
az deployment group create "${common[@]}" "${param_args[@]}" \
  --query properties.outputs --output json

echo
echo "Selesai. Output di atas tidak memuat secret. Langkah berikutnya ada di infra/README.md."
