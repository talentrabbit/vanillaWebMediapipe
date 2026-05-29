$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$pidFile = Join-Path $repoRoot ".dev-server.pid"

if (-not (Test-Path $pidFile)) {
  Write-Host "No PID file found. Server may already be stopped."
  exit 0
}

$pidValue = (Get-Content $pidFile -Raw).Trim()
if (-not $pidValue) {
  Remove-Item $pidFile -Force
  Write-Host "PID file was empty and has been removed."
  exit 0
}

$process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
if ($process) {
  Stop-Process -Id $pidValue -Force
  Write-Host "Stopped server process $pidValue"
} else {
  Write-Host "Process $pidValue is not running."
}

Remove-Item $pidFile -Force
