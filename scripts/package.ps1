<#
Package the project into a ZIP for portability.

Usage:
  powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1
  powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1 -Output "C:\temp\gesture.zip"
  powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1 -Exclude '.git','node_modules','*.zip'

By default the script places the ZIP next to the project folder (one level up from `scripts`).
#>
param(
  [string]$Output = "",
  [string[]]$Exclude = @('.git', 'node_modules', '*.zip')
)

$ErrorActionPreference = 'Stop'

try {
  $scriptFolder = Split-Path -Parent $MyInvocation.MyCommand.Path
  $root = (Resolve-Path (Join-Path $scriptFolder '..')).Path

  if (-not $Output) {
    $parent = Split-Path -Parent $root
    $name = Split-Path -Leaf $root
    $Output = Join-Path $parent ("${name}.zip")
  } else {
    try {
      $rp = Resolve-Path -Path $Output -ErrorAction Stop
      $Output = $rp.Path
    } catch {
      # If Resolve-Path can't find the target (e.g. non-existent file yet), convert to an absolute path.
      try {
        $Output = [System.IO.Path]::GetFullPath($Output)
      } catch {
        # fallback to join with current location
        $Output = Join-Path (Get-Location) $Output
      }
    }
  }

  Write-Host "Project root:" $root
  Write-Host "Output ZIP:" $Output

  $tempDir = Join-Path $env:TEMP ("gesturepkg_" + [guid]::NewGuid().ToString())
  New-Item -ItemType Directory -Path $tempDir | Out-Null

  Write-Host "Creating temporary staging folder:" $tempDir

  $files = Get-ChildItem -Path $root -Recurse -Force -File

  foreach ($file in $files) {
    $rel = $file.FullName.Substring($root.Length).TrimStart('\','/')
    $skip = $false
    foreach ($ex in $Exclude) {
      # simple wildcard match against relative path
      if ($rel -like ("*" + $ex + "*")) {
        $skip = $true
        break
      }
    }

    if ($skip) { continue }

    $dest = Join-Path $tempDir $rel
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir | Out-Null }
    Copy-Item -Path $file.FullName -Destination $dest -Force
  }

  if (Test-Path $Output) { Remove-Item -Path $Output -Force }

  Write-Host "Compressing..."
  Compress-Archive -Path (Join-Path $tempDir '*') -DestinationPath $Output -Force

  Write-Host "Cleaning up temporary files..."
  Remove-Item -Path $tempDir -Recurse -Force

  Write-Host "Package created:" $Output
  exit 0
} catch {
  Write-Error "Packaging failed: $_"
  if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force }
  exit 1
}
