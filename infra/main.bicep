// Kobi: infrastruktur Azure (scope: resource group).
//
// STATUS: BELUM DIVALIDASI. `az bicep build`, `az deployment group validate`,
// dan `what-if` belum pernah dijalankan terhadap berkas ini (az/bicep belum
// terpasang saat berkas ditulis). Semua API version, nama properti, dan SKU
// ditulis dari ingatan dan dokumentasi, bukan dari hasil kompilasi. Lihat
// infra/README.md untuk langkah validasi.
//
// Tidak ada secret di berkas ini. `pgAdminPassword` dan `authSecret` adalah
// parameter @secure() yang diisi saat deploy (lihat infra/deploy.sh). Kunci
// layanan Azure diambil dengan listKeys() saat deployment, lalu ditulis ke
// Application Settings Web App. Tidak ada kunci yang masuk ke output.

metadata description = 'Kobi: App Service, PostgreSQL Flexible, Azure OpenAI, Maps, Document Intelligence, Storage privat, Application Insights'

// ---------------------------------------------------------------------------
// Parameter
// ---------------------------------------------------------------------------

@description('Awalan nama sumber daya. Huruf kecil dan angka saja (dipakai juga untuk nama storage account).')
@minLength(3)
@maxLength(12)
param namePrefix string = 'kobi'

@description('Nama lingkungan, bagian dari nama sumber daya.')
@minLength(2)
@maxLength(8)
param environmentName string = 'prod'

@description('Region utama (App Service, Storage, Log Analytics, App Insights).')
param location string = resourceGroup().location

@description('Region PostgreSQL Flexible Server. Beberapa subscription pelajar membatasi region untuk PostgreSQL; ubah di sini bila terkena RequestDisallowedByAzure.')
param postgresLocation string = location

@description('Region akun Azure OpenAI. Ketersediaan model dan kuota berbeda per region; periksa dulu (#54).')
param openAiLocation string = location

@description('Region akun Document Intelligence.')
param docIntelLocation string = location

@description('SKU App Service Plan. B1 = Basic terkecil yang mendukung Always On. F1 (gratis) tidak mendukung Always On dan kuota CPU-nya kecil.')
@allowed([
  'F1'
  'B1'
  'B2'
  'P0v3'
])
param appServiceSkuName string = 'B1'

@description('Path health check Web App. Kosongkan untuk mematikan. Endpoint /api/health dibuat di tugas C4; bila belum ada, kosongkan dulu.')
param healthCheckPath string = '/api/health'

@description('Login admin PostgreSQL. Tidak boleh admin, administrator, root, guest, public, atau azure_superuser.')
param pgAdminLogin string = 'kobiadmin'

@description('Password admin PostgreSQL (8-128 karakter, minimal 3 dari 4 kategori: huruf besar, kecil, angka, simbol).')
@secure()
param pgAdminPassword string

@description('Rahasia Auth.js (AUTH_SECRET). Buat sekali dengan `openssl rand -base64 32` dan simpan; mengganti nilainya membatalkan semua sesi login.')
@secure()
param authSecret string

@description('Alamat IP publik yang boleh mengakses PostgreSQL langsung (mis. IP komputer admin untuk psql/migrate manual). Akses dari layanan Azure (App Service) sudah dibuka terpisah.')
param allowedClientIps array = []

@description('Nama deployment model Azure OpenAI. Nilai ini menjadi AZURE_OPENAI_DEPLOYMENT.')
param openAiDeploymentName string = 'kobi-estimator'

@description('Nama model Azure OpenAI. BELUM DIPASTIKAN tersedia di region/subscription target; cek `az cognitiveservices model list` (#54).')
param openAiModelName string = 'gpt-4o-mini'

@description('Versi model. BELUM DIPASTIKAN masih didukung; cek `az cognitiveservices model list` (#54).')
param openAiModelVersion string = '2024-07-18'

@description('SKU deployment: Standard (regional), GlobalStandard, dst. Pilih yang kuotanya ada di subscription.')
param openAiDeploymentSku string = 'Standard'

@description('Kapasitas deployment dalam ribuan token per menit (10 = 10K TPM). Kecil sudah cukup untuk MVP dan menekan risiko gagal karena kuota.')
param openAiCapacity int = 10

@description('Set false untuk membuat akun Azure OpenAI tanpa deployment model (mis. kuota belum ada). Deployment lalu dibuat manual atau deploy ulang dengan true.')
param deployOpenAiModel bool = true

@description('SKU Document Intelligence: S0 (bayar per halaman, tanpa biaya tetap) atau F0 (gratis, hanya satu per subscription per region).')
@allowed([
  'S0'
  'F0'
])
param docIntelSkuName string = 'S0'

@description('Nama container privat untuk foto struk.')
param receiptsContainerName string = 'struk'

@description('Hari retensi data Log Analytics.')
@minValue(30)
@maxValue(730)
param logRetentionDays int = 30

@description('Tag untuk semua sumber daya.')
param tags object = {
  app: 'kobi'
}

// ---------------------------------------------------------------------------
// Nama
// ---------------------------------------------------------------------------

var prefix = toLower(namePrefix)
var baseName = '${prefix}-${environmentName}'
// Sufiks deterministik per resource group; menjaga nama yang harus unik global.
var suffix = take(uniqueString(resourceGroup().id), 6)

var planName = 'asp-${baseName}'
var webAppName = 'app-${baseName}-${suffix}'
var postgresName = 'psql-${baseName}-${suffix}'
var postgresDbName = 'kobi'
var openAiName = 'oai-${baseName}-${suffix}'
var docIntelName = 'di-${baseName}-${suffix}'
var mapsName = 'map-${baseName}'
// Storage account: 3-24 karakter, huruf kecil dan angka saja.
var storageName = 'st${take(replace(baseName, '-', ''), 10)}${suffix}'
var logName = 'log-${baseName}'
var appInsightsName = 'appi-${baseName}'

// ---------------------------------------------------------------------------
// Log Analytics + Application Insights
// ---------------------------------------------------------------------------

// API 2023-09-01. PerGB2018 adalah SKU bayar-per-GB yang berlaku sekarang;
// 5 GB/bulan pertama gratis, cukup untuk MVP.
resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: logRetentionDays
  }
}

// API 2020-02-02 (versi stabil untuk Application Insights berbasis workspace).
// Terhubung ke Log Analytics supaya log dan telemetri satu tempat.
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logWorkspace.id
    IngestionMode: 'LogAnalytics'
  }
}

// ---------------------------------------------------------------------------
// Storage account + container privat (foto struk, S1)
// ---------------------------------------------------------------------------

// API 2023-05-01. Standard_LRS = redundansi lokal, termurah; foto struk bukan
// data kritis. Akses blob publik dimatikan di level akun, jadi container tidak
// bisa dibuka publik walaupun salah konfigurasi. Akses lewat SAS berumur
// pendek (arsitektur bagian 12).
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    // Kunci akun dipakai aplikasi lewat connection string (AZURE_STORAGE_CONNECTION_STRING).
    allowSharedKeyAccess: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    publicNetworkAccess: 'Enabled'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource receiptsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: receiptsContainerName
  properties: {
    publicAccess: 'None'
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL Flexible Server
// ---------------------------------------------------------------------------

// API 2024-08-01 (GA). Burstable Standard_B1ms (1 vCPU, 2 GiB) adalah tier
// terkecil yang cocok untuk beban MVP dan kredit pelajar. Tanpa HA dan tanpa
// geo-redundant backup untuk menekan biaya; backup otomatis 7 hari.
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresName
  location: postgresLocation
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: pgAdminLogin
    administratorLoginPassword: pgAdminPassword
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: postgresDbName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// SSL wajib. ON adalah default server baru; ditulis eksplisit supaya niatnya
// terdokumentasi dan tidak bergeser diam-diam. Operasi anak pada satu server
// tidak boleh paralel, jadi diberi dependsOn berantai (database, config,
// firewall).
resource postgresRequireSsl 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: postgres
  name: 'require_secure_transport'
  properties: {
    value: 'ON'
    source: 'user-override'
  }
  dependsOn: [
    postgresDb
  ]
}

// Rentang 0.0.0.0-0.0.0.0 adalah konvensi Azure untuk "izinkan layanan Azure".
// Ini mengizinkan SEMUA sumber daya Azure (termasuk milik tenant lain) sampai
// ke port server; pertahanan terakhir tetap password + SSL. Alternatif yang
// lebih ketat (VNet integration + private endpoint) menambah biaya dan
// kompleksitas yang tidak sepadan untuk MVP.
resource postgresAllowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
  dependsOn: [
    postgresRequireSsl
  ]
}

@batchSize(1)
resource postgresClientRules 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = [for (ip, i) in allowedClientIps: {
  parent: postgres
  name: 'client-${i}'
  properties: {
    startIpAddress: ip
    endIpAddress: ip
  }
  dependsOn: [
    postgresAllowAzure
  ]
}]

// ---------------------------------------------------------------------------
// Azure OpenAI
// ---------------------------------------------------------------------------

// API 2024-10-01. S0 adalah satu-satunya SKU akun; biaya murni per token.
// customSubDomainName wajib agar endpoint berbentuk
// https://<nama>.openai.azure.com/ dan kunci API bisa dipakai.
resource openAi 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: openAiName
  location: openAiLocation
  tags: tags
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: openAiName
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

// Kapasitas kecil (default 10K TPM) menekan risiko gagal karena kuota dan
// membatasi biaya maksimum. Model, versi, dan SKU adalah parameter karena
// ketersediaannya berubah per region dan per waktu (#54).
resource openAiDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = if (deployOpenAiModel) {
  parent: openAi
  name: openAiDeploymentName
  sku: {
    name: openAiDeploymentSku
    capacity: openAiCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: openAiModelName
      version: openAiModelVersion
    }
  }
}

// ---------------------------------------------------------------------------
// Azure Maps
// ---------------------------------------------------------------------------

// API 2023-06-01. Gen2 (SKU G2) dipakai; Gen1 (S0/S1) kabarnya dijadwalkan
// pensiun, BELUM DIVERIFIKASI ke dokumentasi Azure. Gen2 bayar per transaksi
// dengan kuota gratis bulanan (juga belum diverifikasi). Lokasi akun Maps
// selalu 'global'.
resource maps 'Microsoft.Maps/accounts@2023-06-01' = {
  name: mapsName
  location: 'global'
  tags: tags
  kind: 'Gen2'
  sku: {
    name: 'G2'
  }
  properties: {
    disableLocalAuth: false
  }
}

// ---------------------------------------------------------------------------
// Azure AI Document Intelligence (S1, stretch)
// ---------------------------------------------------------------------------

// API 2024-10-01, kind FormRecognizer. S0 tanpa biaya tetap (bayar per
// halaman) sehingga aman dibiarkan menyala walaupun S1 belum dipakai.
resource docIntel 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: docIntelName
  location: docIntelLocation
  tags: tags
  kind: 'FormRecognizer'
  sku: {
    name: docIntelSkuName
  }
  properties: {
    customSubDomainName: docIntelName
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

// ---------------------------------------------------------------------------
// App Service Plan + Web App
// ---------------------------------------------------------------------------

// API 2023-12-01. Linux wajib reserved: true. B1 (1 core, 1.75 GB) cukup untuk
// Next.js beban demo dan mendukung Always On.
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: appServiceSkuName
  }
  properties: {
    reserved: true
  }
}

// API 2023-12-01. HTTPS only, TLS minimum 1.2, FTP dimatikan, managed identity
// sistem aktif (belum ada role assignment: aplikasi memakai connection string;
// identity disiapkan untuk migrasi ke Key Vault / akses tanpa kunci nanti).
// Paket aplikasi sudah dibangun di CI (SCM_DO_BUILD_DURING_DEPLOYMENT=false),
// jadi App Service hanya menjalankan `npm run start`.
resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      alwaysOn: appServiceSkuName != 'F1'
      appCommandLine: 'npm run start'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      healthCheckPath: empty(healthCheckPath) ? null : healthCheckPath
      appSettings: [
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
        {
          // Port yang didengarkan kontainer Node di App Service Linux.
          name: 'WEBSITES_PORT'
          value: '8080'
        }
        {
          // Auth.js v5 di belakang proxy App Service perlu mempercayai header host.
          // BELUM DIVERIFIKASI terhadap konfigurasi auth aplikasi.
          name: 'AUTH_TRUST_HOST'
          value: 'true'
        }
        {
          name: 'AUTH_SECRET'
          value: authSecret
        }
        {
          // sslmode=require sesuai arsitektur 5.4. Password di-encode agar aman di URL.
          name: 'DATABASE_URL'
          value: 'postgresql://${pgAdminLogin}:${uriComponent(pgAdminPassword)}@${postgres.properties.fullyQualifiedDomainName}:5432/${postgresDbName}?sslmode=require'
        }
        {
          name: 'AZURE_OPENAI_ENDPOINT'
          value: openAi.properties.endpoint
        }
        {
          name: 'AZURE_OPENAI_API_KEY'
          value: openAi.listKeys().key1
        }
        {
          name: 'AZURE_OPENAI_DEPLOYMENT'
          value: openAiDeploymentName
        }
        {
          name: 'AZURE_MAPS_KEY'
          value: maps.listKeys().primaryKey
        }
        {
          name: 'AZURE_DOCINTEL_ENDPOINT'
          value: docIntel.properties.endpoint
        }
        {
          name: 'AZURE_DOCINTEL_KEY'
          value: docIntel.listKeys().key1
        }
        {
          name: 'AZURE_STORAGE_CONNECTION_STRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
      ]
    }
  }
  dependsOn: [
    openAiDeployment
    postgresDb
    receiptsContainer
  ]
}

// ---------------------------------------------------------------------------
// Output (tanpa secret)
// ---------------------------------------------------------------------------

output webAppName string = webApp.name
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output webAppPrincipalId string = webApp.identity.principalId
output postgresServerName string = postgres.name
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName
output postgresDatabase string = postgresDbName
output openAiEndpoint string = openAi.properties.endpoint
output openAiDeploymentOut string = openAiDeploymentName
output docIntelEndpoint string = docIntel.properties.endpoint
output storageAccountName string = storage.name
output receiptsContainerOut string = receiptsContainerName
output appInsightsName string = appInsights.name
