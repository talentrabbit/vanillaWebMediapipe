param(
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$pidFile = Join-Path $repoRoot ".dev-server.pid"
$nodeServerScript = Join-Path $PSScriptRoot "static-server.js"
$powerShellServerScript = Join-Path $PSScriptRoot "static-server.ps1"

if (-not (Test-Path $nodeServerScript) -and -not (Test-Path $powerShellServerScript)) {
  throw "Missing server scripts in $PSScriptRoot"
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

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue

if ($nodeCommand -and (Test-Path $nodeServerScript)) {
  $process = Start-Process -FilePath $nodeCommand.Source -ArgumentList @($nodeServerScript, "--root", $repoRoot, "--port", $Port) -WorkingDirectory $repoRoot -PassThru
} elseif (Test-Path $powerShellServerScript) {
  $powerShellCommand = Get-Command powershell.exe -ErrorAction Stop
  $process = Start-Process -FilePath $powerShellCommand.Source -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $powerShellServerScript,
    "-Root",
    $repoRoot,
    "-Port",
    $Port
  ) -WorkingDirectory $repoRoot -PassThru
} else {
  throw "Node.js is unavailable and the PowerShell fallback server is missing."
}

Start-Sleep -Milliseconds 500
if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
  if (Test-Path $pidFile) {
    Remove-Item $pidFile -Force
  }

  throw "Server process exited before startup completed."
}

Set-Content -Path $pidFile -Value $process.Id -NoNewline

Write-Host "Server started (PID: $($process.Id))"
Write-Host "Open http://127.0.0.1:$Port"
Write-Host "Stop it with .\scripts\stop.ps1"
