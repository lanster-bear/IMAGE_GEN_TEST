$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$runtimePath = (Get-Command node -ErrorAction Stop).Source
$serverPath = Join-Path $projectRoot 'server\index.mjs'
$statePath = Join-Path $projectRoot '.data'
# Ask the same config loader as the server; .env and PORT stay consistent.
$portText = & $runtimePath (Join-Path $PSScriptRoot 'port.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Unable to load studio configuration.' }
$studioPort = [int]$portText
$studioUrl = "http://127.0.0.1:$studioPort"
function Get-StudioHealth {
    try { return Invoke-RestMethod -Uri "$studioUrl/api/health" -TimeoutSec 2 } catch { return $null }
}
$existing = Get-StudioHealth
if ($existing -and $existing.app -eq 'image-gen-studio') {
    Start-Process $studioUrl
    Write-Host "Studio is already running: $studioUrl"
    exit 0
}
if (Get-NetTCPConnection -LocalPort $studioPort -State Listen -ErrorAction SilentlyContinue) {
    throw "Port $studioPort belongs to another service. Set a different PORT in .env."
}
New-Item -ItemType Directory -Path $statePath -Force | Out-Null
$process = Start-Process -FilePath $runtimePath -ArgumentList "`"$serverPath`"" -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $statePath 'server.log') -RedirectStandardError (Join-Path $statePath 'server-error.log')
for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 200
    $health = Get-StudioHealth
    if ($health -and $health.app -eq 'image-gen-studio' -and $health.pid -eq $process.Id) {
        Start-Process $studioUrl
        Write-Host "Studio ready: $studioUrl"
        exit 0
    }
    if ($process.HasExited) { break }
}
throw 'Studio did not start. Check .data/server-error.log.'
