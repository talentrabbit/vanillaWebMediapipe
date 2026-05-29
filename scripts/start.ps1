param(
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$pidFile = Join-Path $repoRoot ".dev-server.pid"
$serverScript = Join-Path $PSScriptRoot "static-server.js"

if (-not (Test-Path $serverScript)) {
  throw "Missing server script at $serverScript"
}

if (Test-Path $pidFile) {
  $existingPid = (Get-Content $pidFile -Raw).Trim()
  if ($existingPid -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
    Write-Host "Server is already running with PID $existingPid"
    Write-Host "Open http://127.0.0.1:$Port"
    exit 0
  }

  Remove-Item $pidFile -Force
}

$process = Start-Process -FilePath "node" -ArgumentList @($serverScript, "--root", $repoRoot, "--port", $Port) -WorkingDirectory $repoRoot -PassThru
Set-Content -Path $pidFile -Value $process.Id -NoNewline

Write-Host "Server started (PID: $($process.Id))"
Write-Host "Open http://127.0.0.1:$Port"
Write-Host "Stop it with .\scripts\stop.ps1"
