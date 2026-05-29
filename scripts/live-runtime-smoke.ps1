param(
  [string]$ApiBaseUrl = "http://localhost:3000/api/v1",
  [string]$RuntimeToken = "",
  [switch]$SkipSipRegister
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Load-DotEnvIfPresent {
  $envPath = Join-Path $PSScriptRoot "..\.env"
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
    if (-not [System.Environment]::GetEnvironmentVariable($key)) {
      [System.Environment]::SetEnvironmentVariable($key, $value)
    }
  }
}

function Write-Step($message) {
  Write-Host "==> $message" -ForegroundColor Cyan
}

Load-DotEnvIfPresent

if (-not $RuntimeToken) {
  $RuntimeToken = $env:RUNTIME_API_TOKEN
}

if (-not $RuntimeToken) {
  throw "RUNTIME_API_TOKEN must be provided either as a parameter or in .env"
}

Write-Step "Check API health"
$healthUrl = $ApiBaseUrl -replace '/api/v1$', '/health'
$health = Invoke-RestMethod -Method GET -Uri $healthUrl
if ($health.status -ne "ok") {
  throw "API health check failed"
}

Write-Step "Run control-plane and IVR runtime smoke"
& (Join-Path $PSScriptRoot "mvp-smoke.ps1") -ApiBaseUrl $ApiBaseUrl -RuntimeToken $RuntimeToken
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

if (-not $SkipSipRegister) {
  Write-Step "Run SIP REGISTER smoke"
  node (Join-Path $PSScriptRoot "sip-register-smoke.mjs")
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

Write-Host ""
Write-Host "Live runtime smoke passed." -ForegroundColor Green
