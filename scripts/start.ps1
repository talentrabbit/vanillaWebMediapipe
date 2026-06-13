param(
  [int]$Port = 8080,
  [bool]$Secure = $false
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$pidFile = Join-Path $repoRoot ".dev-server.pid"
$nodeServerScript = Join-Path $PSScriptRoot "static-server.js"
$powerShellServerScript = Join-Path $PSScriptRoot "static-server.ps1"
$scheme = "http"
if ($Secure) { $scheme = "https" }

$serverUrl = "{$scheme}://127.0.0.1:$Port"
$hostName = [System.Net.Dns]::GetHostName()
$remoteUrl = "{$scheme}://{$hostName}:$Port"

if (-not (Test-Path $nodeServerScript) -and -not (Test-Path $powerShellServerScript)) {
  throw "Missing server scripts in $PSScriptRoot"
}

if (Test-Path $pidFile) {
  $existingPid = (Get-Content $pidFile -Raw).Trim()
  if ($existingPid -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
    Write-Host "Server is already running with PID $existingPid"
    Write-Host "Open $serverUrl"
    exit 0
  }

  Remove-Item $pidFile -Force
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$pwshCommand = Get-Command pwsh -ErrorAction SilentlyContinue
$windowsPowerShell = Get-Command powershell.exe -ErrorAction SilentlyContinue

if ($pwshCommand) {
  $powerShellPath = $pwshCommand.Path
} elseif ($windowsPowerShell) {
  $powerShellPath = $windowsPowerShell.Path
} else {
  $powerShellPath = $null
}

# Logging: capture child stdout/stderr to enable debugging when startup fails
$logOut = Join-Path $repoRoot 'start-server-out.log'
$logErr = Join-Path $repoRoot 'start-server-err.log'
$logCombined = Join-Path $repoRoot 'start-server.log'
Remove-Item -Path $logOut,$logErr,$logCombined -ErrorAction SilentlyContinue


if ($Secure) {
  if (-not (Test-Path $powerShellServerScript)) {
    throw "Secure mode requires the PowerShell server fallback script at $powerShellServerScript"
  }

  if (-not $powerShellCommand) {
    throw "Secure mode requires PowerShell 7 (pwsh) or Windows PowerShell to be available."
  }

  $powerShellArgs = @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $powerShellServerScript,
    "-Root",
    $repoRoot,
    "-Port",
    $Port,
    "-Secure"
  )

  if (-not $powerShellPath) { throw "Secure mode requires PowerShell 7 (pwsh) or Windows PowerShell to be available." }
  $process = Start-Process -FilePath $powerShellPath -ArgumentList $powerShellArgs -RedirectStandardOutput $logOut -RedirectStandardError $logErr -NoNewWindow -PassThru -WorkingDirectory $repoRoot
} elseif ($nodeCommand -and (Test-Path $nodeServerScript)) {
  $process = Start-Process -FilePath $nodeCommand.Path -ArgumentList @($nodeServerScript, "--root", $repoRoot, "--port", $Port) -RedirectStandardOutput $logOut -RedirectStandardError $logErr -NoNewWindow -PassThru -WorkingDirectory $repoRoot
} elseif (Test-Path $powerShellServerScript) {
  if (-not $powerShellPath) {
    throw "PowerShell is unavailable and Node.js is missing."
  }

  $process = Start-Process -FilePath $powerShellPath -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $powerShellServerScript,
    "-Root",
    $repoRoot,
    "-Port",
    $Port
  ) -RedirectStandardOutput $logOut -RedirectStandardError $logErr -NoNewWindow -PassThru -WorkingDirectory $repoRoot
} else {
  throw "Node.js is unavailable and the PowerShell fallback server is missing."
}

Start-Sleep -Seconds 2
if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
  if (Test-Path $pidFile) {
    Remove-Item $pidFile -Force
  }

  # collect logs for debugging
  try {
    $outText = ''
    if (Test-Path $logOut) { $outText = Get-Content $logOut -Raw -ErrorAction SilentlyContinue }
    $errText = ''
    if (Test-Path $logErr) { $errText = Get-Content $logErr -Raw -ErrorAction SilentlyContinue }
    $combined = "=== STDOUT ===`r`n$($outText)`r`n=== STDERR ===`r`n$($errText)`r`n"
    Set-Content -Path $logCombined -Value $combined -NoNewline
  } catch {
    # ignore log write errors
  }

  throw "Server process exited before startup completed. See $logCombined for details."
}

Set-Content -Path $pidFile -Value $process.Id -NoNewline

Write-Host "Server started (PID: $($process.Id))"
Write-Host "Open $serverUrl"
if ($hostName -and $hostName -ne "localhost") {
  Write-Host "Remote access may also be available at $remoteUrl"
}
if ($Secure) {
  Write-Host "Note: this uses a self-signed certificate; your browser may prompt to accept it."
}
Write-Host "Stop it with .\scripts\stop.ps1"
