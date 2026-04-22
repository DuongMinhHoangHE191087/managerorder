$ErrorActionPreference = 'Stop'

$projectRoot = Join-Path $PSScriptRoot '..'
Set-Location $projectRoot

$env:SHORT_LINK_SMOKE_ALLOW_DEGRADED = '1'
Write-Host 'Running short-link public smoke in degraded mode (schema migration not yet applied)...'
& npm.cmd run smoke:short-links
