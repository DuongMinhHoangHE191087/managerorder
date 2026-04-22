$ErrorActionPreference = 'Stop'

$projectRoot = Join-Path $PSScriptRoot '..'
Set-Location $projectRoot

$port = 3002
$baseUrl = "http://localhost:$port"

$serverOut = Join-Path $projectRoot 'tmp-short-link-smoke.out.log'
$serverErr = Join-Path $projectRoot 'tmp-short-link-smoke.err.log'
Remove-Item -LiteralPath $serverOut, $serverErr -ErrorAction SilentlyContinue

$serverProcess = Start-Process -FilePath 'npx.cmd' -ArgumentList 'next', 'start', '-p', $port.ToString() -PassThru -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr

try {
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  $ready = $false

  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      $client = [System.Net.Sockets.TcpClient]::new()
      $client.Connect('127.0.0.1', $port)
      $client.Close()
      $ready = $true
      break
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  if (-not $ready) {
    throw "Next.js standalone server did not become ready on port $port."
  }

  $env:SHORT_LINK_SMOKE_ALLOW_DEGRADED = '1'
  $env:BASE_URL = $baseUrl
  & node ./scripts/short-link-public-smoke.mjs
  $exitCode = $LASTEXITCODE

  if ($exitCode -ne 0) {
    throw "Short-link smoke failed with exit code $exitCode."
  }
}
finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
