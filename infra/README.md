# Infrastruktur Azure Kobi

> **BELUM DIVALIDASI.** `az bicep build`, `az deployment group validate`, dan
> `az deployment group what-if` **belum pernah dijalankan** terhadap
> `main.bicep`, karena `az` dan `bicep` belum terpasang dan belum ada
> subscription Azure. Yang sudah dicek hanya sintaks bash `deploy.sh`
> (`bash -n`) dan sintaks YAML `deploy.yml`. API version, nama properti, SKU,
> dan nama model ditulis dari ingatan/dokumentasi dan bisa salah. Jangan
> menganggap berkas di folder ini benar sampai langkah validasi di bawah lulus.
> Hal yang paling mungkin perlu dikoreksi ditandai di bagian
> [Hal yang belum teruji](#hal-yang-belum-teruji).

Berkas:

| Berkas | Isi |
|---|---|
| `main.bicep` | Seluruh sumber daya (scope resource group) |
| `deploy.sh` | Pembungkus az CLI: build, validate, what-if/create, tanpa secret di berkas |
| `../.github/workflows/deploy.yml` | Deploy aplikasi lewat GitHub Actions + OIDC (manual dulu) |

## Langkah validasi (jalankan begitu `az` ada)

Urutan dari yang paling murah. Berhenti dan perbaiki Bicep bila ada yang gagal.

1. Pasang az CLI dan Bicep: `az upgrade` lalu `az bicep install` (atau
   `az bicep upgrade`). Cek `az --version` dan `az bicep version`.
2. Kompilasi dan lint (tanpa Azure, tanpa login):
   ```bash
   az bicep build --file infra/main.bicep --stdout > /dev/null
   az bicep lint --file infra/main.bicep
   ```
   Kompilasi harus bersih dari error. Baca setiap warning; sebagian wajar
   (mis. `dependsOn` eksplisit), sebagian bisa menunjuk salah tipe/properti.
3. Login dan pilih subscription: `az login`, `az account set --subscription <id>`.
4. Cek provider terdaftar (sekali per subscription; kadang butuh beberapa menit):
   ```bash
   for ns in Microsoft.Web Microsoft.DBforPostgreSQL Microsoft.CognitiveServices \
             Microsoft.Maps Microsoft.Storage Microsoft.OperationalInsights Microsoft.Insights; do
     az provider register --namespace "$ns"
   done
   az provider list --query "[?registrationState=='Registered'].namespace" -o tsv
   ```
5. Cek API version dan ketersediaan di region target, misalnya:
   ```bash
   az provider show --namespace Microsoft.DBforPostgreSQL \
     --query "resourceTypes[?resourceType=='flexibleServers'].apiVersions[]" -o tsv
   az provider show --namespace Microsoft.CognitiveServices \
     --query "resourceTypes[?resourceType=='accounts'].apiVersions[]" -o tsv
   az postgres flexible-server list-skus --location <region> -o table
   ```
   Bila versi di `main.bicep` tidak ada di daftar, ganti ke yang terdaftar dan
   ulangi langkah 2.
6. Cek model Azure OpenAI (lihat [Kuota Azure OpenAI](#kuota-azure-openai-54)).
7. Validasi di sisi Azure dan what-if (membuat resource group kosong bila belum
   ada, tidak membuat sumber daya lain):
   ```bash
   export KOBI_PG_ADMIN_PASSWORD="$(openssl rand -base64 24)"
   export KOBI_AUTH_SECRET="$(openssl rand -base64 32)"   # simpan nilainya!
   ./infra/deploy.sh -g rg-kobi-prod -l <region> --what-if
   ```
   Baca output what-if: harus ada 1 plan, 1 web app, 1 PostgreSQL + database
   + 2 konfigurasi/aturan firewall, 3 akun Cognitive/Maps, 1 storage + container,
   1 workspace, 1 App Insights. Pastikan `appSettings` web app terisi semua.
8. Setelah apply sungguhan (C8), verifikasi, bukan asumsi:
   - `az webapp config appsettings list -g <rg> -n <app> --query "[].name" -o tsv`
     memuat semua variabel di tabel di bawah.
   - `az storage container show` / portal: akses publik container `None`.
   - `psql "host=<fqdn> dbname=kobi user=kobiadmin sslmode=require"` berhasil,
     dan koneksi `sslmode=disable` ditolak.
   - `curl -I http://<app>.azurewebsites.net` mengalihkan ke HTTPS.

Setelah lulus, hapus banner "BELUM DIVALIDASI" di berkas ini dan di
`main.bicep` / `deploy.sh`, dan catat versi `az`/`bicep` yang dipakai.

## Sumber daya yang dibuat

| Sumber daya | Tipe (API version) | SKU / ukuran |
|---|---|---|
| App Service Plan | `Microsoft.Web/serverfarms@2023-12-01` | Linux, B1 (parameter `appServiceSkuName`) |
| Web App | `Microsoft.Web/sites@2023-12-01` | Node 22 LTS, HTTPS only, TLS 1.2, FTP mati, managed identity sistem, startup `npm run start` |
| PostgreSQL Flexible Server | `Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01` | Burstable `Standard_B1ms`, PG 16, 32 GB, tanpa HA, SSL wajib, database `kobi` |
| Azure OpenAI | `Microsoft.CognitiveServices/accounts@2024-10-01` (`kind: OpenAI`) | S0 + deployment model (parameter) |
| Azure Maps | `Microsoft.Maps/accounts@2023-06-01` | Gen2 (`G2`), lokasi `global` |
| Document Intelligence | `Microsoft.CognitiveServices/accounts@2024-10-01` (`kind: FormRecognizer`) | S0 (parameter, bisa F0) |
| Storage | `Microsoft.Storage/storageAccounts@2023-05-01` | Standard_LRS, akses blob publik mati, container privat `struk` |
| Log Analytics | `Microsoft.OperationalInsights/workspaces@2023-09-01` | PerGB2018, retensi 30 hari |
| Application Insights | `Microsoft.Insights/components@2020-02-02` | Berbasis workspace |

### Application Settings Web App

Semua diisi otomatis saat deployment. Tidak ada nilai yang ditulis di berkas.

| Setting | Sumber |
|---|---|
| `DATABASE_URL` | FQDN server + login/password admin (parameter `@secure()`), `?sslmode=require` |
| `AUTH_SECRET` | env `KOBI_AUTH_SECRET` (parameter `@secure()`) |
| `AUTH_TRUST_HOST` | `true` (tambahan, lihat catatan belum teruji) |
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` | output akun + `listKeys()` |
| `AZURE_OPENAI_DEPLOYMENT` | parameter `openAiDeploymentName` |
| `AZURE_MAPS_KEY` | `listKeys().primaryKey` |
| `AZURE_DOCINTEL_ENDPOINT`, `AZURE_DOCINTEL_KEY` | output akun + `listKeys()` |
| `AZURE_STORAGE_CONNECTION_STRING` | dirakit dari nama akun + kunci |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | properti `ConnectionString` App Insights |
| `SCM_DO_BUILD_DURING_DEPLOYMENT=false`, `WEBSITES_PORT=8080` | pengaturan platform |

`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` tidak dibuat: login Google belum
diimplementasi (lihat `.env.example`). Nama container struk (`struk`) tidak ada di
`.env.example`; nilainya tersedia di output `receiptsContainerOut` bila kode S1
membutuhkannya.

Keamanan: nilai di Application Settings terlihat oleh siapa pun dengan peran
Contributor/Reader-with-secrets pada Web App. Migrasi ke Azure Key Vault
(managed identity Web App sudah aktif untuk itu) adalah langkah lanjutan, bukan
bagian dari berkas ini.

## Parameter yang harus diisi manusia

| Parameter | Cara mengisi | Catatan |
|---|---|---|
| `KOBI_PG_ADMIN_PASSWORD` (env) | `openssl rand -base64 24` | Jika Azure menolak karena kompleksitas, buat ulang. Simpan di password manager |
| `KOBI_AUTH_SECRET` (env) | `openssl rand -base64 32` | Simpan; mengganti nilai membatalkan semua sesi |
| `-g`, `-l` | resource group dan region | Region PostgreSQL bisa dibatasi subscription pelajar; pakai `-p postgresLocation=...` |
| `openAiLocation`, `openAiModelName`, `openAiModelVersion`, `openAiDeploymentSku`, `openAiCapacity` | `-p key=value` | **Wajib dicek** terhadap kuota nyata (#54) |
| `allowedClientIps` | `-p allowedClientIps='["<ip-publik-anda>"]'` | Untuk `psql`/seed manual dari laptop |
| `healthCheckPath` | `-p healthCheckPath=` (kosong) | Kosongkan bila `/api/health` (C4) belum ada |

## Kuota Azure OpenAI (#54)

Ini risiko terbesar dan **belum dicek**. Model dan versi default
(`gpt-4o-mini`, `2024-07-18`, SKU `Standard`, 10K TPM) hanyalah tebakan awal:

- Tidak semua region punya semua model; kuota per subscription per region per
  model bisa nol, terutama pada akun baru atau kredit pelajar. Akses Azure
  OpenAI juga bisa membutuhkan persetujuan.
- Model dan versi dapat dipensiunkan; versi di atas mungkin sudah tidak
  ditawarkan saat Anda membaca ini.
- Cek sebelum apply (ganti `<region>`):
  ```bash
  az cognitiveservices model list --location <region> \
    --query "[?kind=='OpenAI'].{model:model.name,version:model.version,sku:model.skus[].name}" -o table
  az cognitiveservices usage list --location <region> -o table
  ```
- Bila kuota belum ada, deploy dengan `-p deployOpenAiModel=false` (akun dibuat
  tanpa deployment), lalu buat deployment manual atau deploy ulang dengan
  parameter yang benar. Region OpenAI boleh berbeda dari region lain
  (`-p openAiLocation=...`); latensi lintas region masih wajar untuk MVP, tetapi
  ukur terhadap target 5 detik di PRD.
- Isi `AZURE_OPENAI_DEPLOYMENT` mengikuti `openAiDeploymentName`, bukan nama model.

## Langkah provisioning berurutan

Prasyarat: C1 selesai (subscription, `az` + Bicep terpasang, budget alert) dan
bagian validasi di atas lulus.

1. `az login` dan `az account set --subscription <id>`.
2. Buat budget alert di portal (Cost Management) sebelum membuat apa pun.
3. Siapkan secret di shell (jangan ke berkas, jangan ke riwayat bersama):
   ```bash
   export KOBI_PG_ADMIN_PASSWORD="$(openssl rand -base64 24)"
   export KOBI_AUTH_SECRET="$(openssl rand -base64 32)"
   ```
   Simpan keduanya di password manager sebelum melanjutkan.
4. Dry run: `./infra/deploy.sh -g rg-kobi-prod -l <region> --what-if [-p ...]`.
5. Apply: perintah yang sama tanpa `--what-if`. PostgreSQL biasanya makan 5-10
   menit. Salin output (`webAppName`, `postgresServerName`, `webAppUrl`, dst.).
6. Siapkan OIDC GitHub ke Azure (bagian berikut).
7. Isi variabel/secret GitHub (bagian setelahnya), buat environment `production`.
8. Jalankan workflow **Deploy** secara manual (Actions, Run workflow). Ini
   menjalankan `prisma migrate deploy` lalu mengirim aplikasi.
9. Seed vendor sekali saja, dari komputer yang IP-nya ada di `allowedClientIps`:
   ```bash
   DATABASE_URL='postgresql://kobiadmin:<password-di-url-encode>@<fqdn>:5432/kobi?sslmode=require' npm run db:seed
   ```
10. Smoke test manual: buka `webAppUrl`, daftar akun, catat satu makanan, cek
    Application Insights menerima telemetri. Hanya setelah ini ganti pemicu
    `deploy.yml` ke `push` pada `main` bila diinginkan.

## OIDC GitHub ke Azure (tanpa publish profile)

Satu kali. Ganti `<owner>/<repo>`, `<rg>`, `<subscription-id>`.

```bash
# 1. Aplikasi Entra ID + service principal
APP_ID=$(az ad app create --display-name "kobi-github-deploy" --query appId -o tsv)
az ad sp create --id "$APP_ID"

# 2. Federated credential: hanya job dengan environment "production" di repo ini
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:<owner>/<repo>:environment:production",
  "audiences": ["api://AzureADTokenExchange"]
}'

# 3. Hak akses, dibatasi ke resource group (bukan subscription)
az role assignment create --assignee "$APP_ID" --role Contributor \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<rg>"

echo "client-id: $APP_ID"; az account show --query "{tenant:tenantId, subscription:id}" -o tsv
```

Contributor pada resource group dipakai karena workflow perlu mengubah aturan
firewall PostgreSQL dan men-deploy Web App; peran yang lebih sempit mungkin
cukup tetapi belum dicoba. Tidak ada secret yang dibuat: GitHub menukar token
OIDC berumur pendek pada tiap run.

## Variabel dan secret GitHub untuk `deploy.yml`

Settings, Environments, buat environment `production` (opsional: tambahkan
required reviewer). Nilai berikut bisa diset di tingkat environment atau repo.

| Nama | Jenis | Isi |
|---|---|---|
| `AZURE_CLIENT_ID` | Variable | `appId` dari langkah OIDC |
| `AZURE_TENANT_ID` | Variable | tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Variable | subscription ID |
| `AZURE_RESOURCE_GROUP` | Variable | nama resource group |
| `AZURE_WEBAPP_NAME` | Variable | output `webAppName` |
| `AZURE_POSTGRES_SERVER` | Variable | output `postgresServerName` (nama server, bukan FQDN) |
| `DATABASE_URL` | **Secret** (environment `production`) | `postgresql://kobiadmin:<password-di-url-encode>@<fqdn>:5432/kobi?sslmode=require` |

`DATABASE_URL` adalah satu-satunya secret berumur panjang di GitHub, dipakai
hanya oleh langkah `prisma migrate deploy`. Password harus di-URL-encode
(karakter `+ / =` dari base64 menjadi `%2B %2F %3D`). Untuk menghilangkan secret
ini sepenuhnya, workflow bisa membaca `DATABASE_URL` dari Application Settings
lewat `az webapp config appsettings list`, tetapi itu belum dikerjakan.

Runner GitHub tidak ada di daftar IP PostgreSQL, jadi workflow membuka aturan
firewall sementara `gha-<run-id>` untuk IP runner dan menghapusnya di akhir
(`if: always()`). Bila run dibatalkan paksa sehingga aturan tertinggal, hapus
manual: `az postgres flexible-server firewall-rule delete -g <rg> -n <server> --rule-name gha-<run-id> --yes`.

## Estimasi biaya kasar

**Angka ini perkiraan kasar dari ingatan, belum diverifikasi dengan Azure
Pricing Calculator**, dan berbeda per region. Gunakan hanya untuk anggaran awal
dan periksa ulang sebelum apply.

| Komponen | Perkiraan per bulan (USD) | Sifat |
|---|---|---|
| App Service B1 Linux | sekitar 13 | tetap |
| PostgreSQL Burstable B1ms + 32 GB | sekitar 15 sampai 20 | tetap (bisa dihentikan manual saat tidak dipakai; server yang dihentikan menyala lagi sendiri setelah sekitar 7 hari) |
| Storage LRS (foto struk) | di bawah 1 | pakai |
| Log Analytics + App Insights | 0 sampai beberapa, 5 GB pertama gratis | pakai |
| Azure OpenAI | tergantung token; MVP kecil kemungkinan di bawah 5 | pakai |
| Azure Maps Gen2 | kuota gratis bulanan, kemungkinan 0 pada skala uji | pakai |
| Document Intelligence S0 | per halaman, 0 bila S1 tidak dipakai | pakai |
| **Total tetap** | **sekitar 30 sampai 35** | |

Penghemat: matikan server PostgreSQL dan turunkan plan saat tidak ada demo;
hapus seluruh resource group setelah semester (`az group delete`). Pasang
budget alert sebelum apply.

## Hal yang belum teruji

Semuanya belum diuji karena tidak ada subscription dan tidak ada `az`:

- Kompilasi Bicep, nama properti, dan API version (khususnya
  `flexibleServers@2024-08-01`, `Maps/accounts@2023-06-01`,
  `CognitiveServices@2024-10-01`).
- Deployment model OpenAI (nama, versi, SKU, kuota) dan region.
- Sintaks perintah `az postgres flexible-server firewall-rule create/delete`
  (`--name` = nama server, `--rule-name` = nama aturan) di `deploy.yml`.
- `AUTH_TRUST_HOST=true` belum dicocokkan dengan konfigurasi Auth.js aplikasi,
  dan apakah Auth.js membutuhkan `AUTH_URL`.
- `sslmode=require` pada `pg`/`@prisma/adapter-pg`: versi `pg` terbaru
  memperlakukannya setara `verify-full` dan memeriksa sertifikat; seharusnya
  lolos karena rantai sertifikat Azure dipercaya Node, tetapi belum dicoba.
- Paket deploy penuh dengan `node_modules` dan `npm run start` di App Service
  (termasuk binary `@node-rs/argon2` untuk linux-x64 dan pemuatan
  `next.config.ts`). Setelah C4 (`output: "standalone"`) selesai, paket dan
  perintah startup sebaiknya diganti (`node server.js`).
- Health check `/api/health` hanya valid setelah C4 membuat endpoint-nya.
- Ketepatan peran Contributor tingkat resource group untuk semua langkah
  workflow.
