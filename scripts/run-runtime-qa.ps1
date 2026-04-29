$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
$app = Join-Path $root "apps/admin-web"
$registerLoader = Join-Path $app "scripts/register-ts-loader.mjs"
$supervisorScript = "./scripts/runtime-supervisor.ts"
$registerLoaderUrl = ([System.Uri]::new($registerLoader)).AbsoluteUri
$qaArtifactsDir = Join-Path $root "qa-artifacts/runtime-qa"
$runtimeStdoutLog = Join-Path $qaArtifactsDir "runtime-supervisor.stdout.log"
$runtimeStderrLog = Join-Path $qaArtifactsDir "runtime-supervisor.stderr.log"
$runtimeQaLog = Join-Path $qaArtifactsDir "runtime-qa.log"

New-Item -ItemType Directory -Force -Path $qaArtifactsDir | Out-Null
Remove-Item -LiteralPath $runtimeStdoutLog -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $runtimeStderrLog -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $runtimeQaLog -Force -ErrorAction SilentlyContinue

function Write-RuntimeQaLog {
  param([Parameter(Mandatory = $true)][string]$Message)

  $line = "[{0}] {1}" -f ([DateTimeOffset]::Now.ToString("o")), $Message
  Write-Host $line
  Add-Content -LiteralPath $runtimeQaLog -Value $line
}

function Invoke-NativeStep {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [scriptblock]$ScriptBlock
  )

  Write-RuntimeQaLog "[runtime-qa] $Label"
  & $ScriptBlock
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE."
  }

  Write-RuntimeQaLog "[runtime-qa] $Label completed"
}

function Get-ManagerOrderBaseUrl {
  foreach ($port in 3000, 3001, 3002) {
    try {
      $response = Invoke-RestMethod -Uri "http://localhost:$port/api/health" -TimeoutSec 5
      if ($response.status -eq "ok" -and $response.service -eq "managerorder-admin-web") {
        return "http://localhost:$port"
      }
    } catch {
      continue
    }
  }

  return $null
}

function Test-ManagerOrderPortFree {
  param([int]$Port)

  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::IPv6Any, $Port)
    $listener.Server.DualMode = $true
    $listener.Start()
    $listener.Stop()
    return $true
  } catch {
    return $false
  }
}

$runtimeBaseUrl = Get-ManagerOrderBaseUrl
$runtimePort = $null
if (-not $runtimeBaseUrl) {
  foreach ($candidatePort in 3000, 3001, 3002) {
    if (Test-ManagerOrderPortFree -Port $candidatePort) {
      $runtimePort = $candidatePort
      $runtimeBaseUrl = "http://localhost:$candidatePort"
      break
    }
  }

  if (-not $runtimePort) {
    throw "Unable to find an available port for the ManagerOrder runtime."
  }
}

Write-RuntimeQaLog "[runtime-qa] Using runtime target $runtimeBaseUrl"

$runtimeCommand = @(
  "Set-Location '$app'"
  '$env:TELEGRAM_BOT_TOKEN = '''''
  '$env:ZALO_BOT_TOKEN = '''''
  '$env:CODEX_USE_LOCAL_FALLBACK = ''1'''
  '$env:CODEX_ALLOW_LOCAL_WEBHOOK_READ_FALLBACK = ''1'''
)
if ($runtimePort) {
  $runtimeCommand += @(
    "`$env:PORT = '$runtimePort'"
    "`$env:RUNTIME_BASE_URL = 'http://localhost:$runtimePort'"
    "`$env:BASE_URL = 'http://localhost:$runtimePort'"
  )
}
$runtimeCommand += "node --experimental-strip-types --import '$registerLoaderUrl' $supervisorScript --mode=start"
$runtimeProcess = Start-Process `
  -FilePath "pwsh" `
  -ArgumentList @("-NoProfile", "-Command", ($runtimeCommand -join "; ")) `
  -WorkingDirectory $app `
  -RedirectStandardOutput $runtimeStdoutLog `
  -RedirectStandardError $runtimeStderrLog `
  -PassThru

try {
  Push-Location $root
  try {
    Invoke-NativeStep "build admin-web" { corepack pnpm --dir apps/admin-web run build }
  } finally {
    Pop-Location
  }

  $baseURL = $runtimeBaseUrl
  for ($i = 0; $i -lt 120; $i++) {
    if ($runtimeProcess.HasExited) {
      break
    }
    $baseURL = Get-ManagerOrderBaseUrl
    if ($baseURL) {
      break
    }

    Start-Sleep -Seconds 5
  }

  if (-not $baseURL) {
    Write-RuntimeQaLog "[runtime-qa] Runtime supervisor output follows"
    if (Test-Path $runtimeStdoutLog) {
      Get-Content -LiteralPath $runtimeStdoutLog | Write-Host
    }
    if (Test-Path $runtimeStderrLog) {
      Get-Content -LiteralPath $runtimeStderrLog | Write-Host
    }
    throw "ManagerOrder runtime did not become ready."
  }

  Write-RuntimeQaLog "[runtime-qa] runtime ready at $baseURL"

  Push-Location $root
  try {
    Invoke-NativeStep "telegram runtime smoke" { corepack pnpm --dir apps/admin-web run check:telegram-runtime }
    Invoke-NativeStep "zalo runtime smoke" { corepack pnpm --dir apps/admin-web run check:zalo-runtime }
    Invoke-NativeStep "runtime ops QA" { corepack pnpm --dir apps/admin-web run qa:ops-runtime }
    Invoke-NativeStep "runtime smoke" { corepack pnpm --dir apps/admin-web run smoke:runtime }
    Invoke-NativeStep "visual QA" { corepack pnpm --dir apps/admin-web run qa:visual }
  } finally {
    Pop-Location
  }

  Write-RuntimeQaLog "[runtime-qa] focused runtime QA completed successfully."
} finally {
  if ($runtimeProcess -and -not $runtimeProcess.HasExited) {
    Stop-Process -Id $runtimeProcess.Id -Force -ErrorAction SilentlyContinue
  }

  Write-RuntimeQaLog "[runtime-qa] runtime process cleaned up"
}
