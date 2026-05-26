param(
  [string]$ApiBaseUrl = "http://localhost:3000/api/v1",
  [string]$RuntimeToken = "",
  [string]$TenantName = "Smoke Demo",
  [string]$TenantSlug = ("smoke-" + (Get-Date -Format "yyyyMMddHHmmss")),
  [string]$Email = "",
  [string]$DisplayName = "Smoke Owner",
  [string]$Password = "Secret123!",
  [string]$ExtensionNumber = "200",
  [string]$SipPassword = "PhonePass123!"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Net.Http

function Load-DotEnvIfPresent {
  $envPath = Join-Path $PSScriptRoot "..\\.env"
  if (-not (Test-Path $envPath)) {
    return
  }

  Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') {
      return
    }

    $parts = $_ -split '=', 2
    $key = $parts[0].Trim()
    $value = $parts[1].Trim()
    [System.Environment]::SetEnvironmentVariable($key, $value)
  }
}

function Write-Step($message) {
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers = @{},
    $Body = $null
  )

  $params = @{
    Method = $Method
    Uri = $Url
    Headers = $Headers
  }

  if ($null -ne $Body) {
    $params.ContentType = 'application/json'
    $params.Body = ($Body | ConvertTo-Json -Depth 10)
  }

  Invoke-RestMethod @params
}

function Invoke-Text {
  param(
    [string]$Url,
    [hashtable]$Headers = @{}
  )

  $client = [System.Net.Http.HttpClient]::new()
  try {
    foreach ($entry in $Headers.GetEnumerator()) {
      [void]$client.DefaultRequestHeaders.TryAddWithoutValidation($entry.Key, [string]$entry.Value)
    }

    $response = $client.GetAsync($Url).GetAwaiter().GetResult()
    $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

    return @{
      StatusCode = [int]$response.StatusCode
      Content = $content
    }
  } finally {
    $client.Dispose()
  }
}

Load-DotEnvIfPresent

if (-not $RuntimeToken) {
  $RuntimeToken = $env:RUNTIME_API_TOKEN
}

if (-not $Email) {
  $Email = "owner@$TenantSlug.local"
}

if (-not $RuntimeToken) {
  throw "RUNTIME_API_TOKEN must be provided either as a parameter or in .env"
}

$directoryDomain = "$TenantSlug.managecallai.local"

Write-Step "Register tenant"
$register = Invoke-Json -Method POST -Url "$ApiBaseUrl/auth/register" -Body @{
  tenant_name = $TenantName
  tenant_slug = $TenantSlug
  email = $Email
  display_name = $DisplayName
  password = $Password
}

$token = $register.token
if (-not $token) {
  throw "Registration did not return a token"
}

$authHeaders = @{ Authorization = "Bearer $token" }

Write-Step "Create extension"
$extension = Invoke-Json -Method POST -Url "$ApiBaseUrl/extensions" -Headers $authHeaders -Body @{
  extension_number = $ExtensionNumber
  display_name = "Smoke Extension"
  sip_password = $SipPassword
}

if ($extension.data.extension_number -ne $ExtensionNumber) {
  throw "Extension create response did not contain the expected extension number"
}

Write-Step "Call FreeSWITCH directory endpoint"
$directoryUrl = "$ApiBaseUrl/freeswitch/directory?user=$ExtensionNumber&domain=$directoryDomain"
$directory = Invoke-Text -Url $directoryUrl -Headers @{ Authorization = "Bearer $RuntimeToken" }
if ($directory.StatusCode -ne 200 -or $directory.Content -notmatch $SipPassword) {
  throw "Directory lookup did not return the expected XML/password"
}

Write-Step "Ingest test call event"
$ingest = Invoke-Json -Method POST -Url "$ApiBaseUrl/call-events/internal/ingest" -Headers @{ Authorization = "Bearer $RuntimeToken" } -Body @{
  tenant_id = $extension.data.tenant_id
  call_id = "smoke-call-1"
  event_type = "channel_create"
  payload = @{
    step = "created"
  }
}

if (-not $ingest.data.id) {
  throw "Call event ingest did not return an event id"
}

Write-Step "List call events"
$events = Invoke-Json -Method GET -Url "$ApiBaseUrl/call-events" -Headers $authHeaders
if (-not ($events.data | Where-Object { $_.call_id -eq "smoke-call-1" })) {
  throw "Call event list did not include the ingested event"
}

Write-Host ""
Write-Host "Smoke test passed." -ForegroundColor Green
Write-Host "Tenant slug: $TenantSlug"
Write-Host "Directory domain: $directoryDomain"
