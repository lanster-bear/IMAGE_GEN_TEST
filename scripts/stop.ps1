$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$runtimePath = (Get-Command node -ErrorAction Stop).Source
$portText = & $runtimePath (Join-Path $PSScriptRoot 'port.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Unable to load studio configuration.' }
$studioPort = [int]$portText
try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:$studioPort/api/health" -TimeoutSec 2 }
catch { Write-Host 'Studio is not running.'; exit 0 }
if ($health.app -ne 'image-gen-studio') { throw 'This port does not belong to Image Studio.' }
if ($health.pending -gt 0) { throw 'Tasks are still queued or generating. Wait for them to finish before stopping.' }
$targetProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($health.pid)"
$serverPath = Join-Path $projectRoot 'server\index.mjs'
$command = [string]$targetProcess.CommandLine
if (!$targetProcess -or (!$command.Contains($serverPath) -and !$command.Contains('ImageStudio.exe'))) { throw 'Process identity could not be verified. Stop the foreground server manually.' }
Stop-Process -Id $health.pid
Write-Host 'Studio stopped. Images and history were preserved.'
