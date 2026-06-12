param(
  [Parameter(Mandatory = $true)]
  [string]$Root,

  [int]$Port = 8080,

  [string]$BindAddress = "0.0.0.0"
)

$ErrorActionPreference = "Stop"

$resolvedRoot = (Resolve-Path $Root).Path
$rootWithSeparator = if ($resolvedRoot.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
  $resolvedRoot
} else {
  $resolvedRoot + [System.IO.Path]::DirectorySeparatorChar
}

$mimeTypes = @{
  ".css" = "text/css; charset=utf-8"
  ".html" = "text/html; charset=utf-8"
  ".ico" = "image/x-icon"
  ".jpeg" = "image/jpeg"
  ".jpg" = "image/jpeg"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".map" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".svg" = "image/svg+xml"
  ".txt" = "text/plain; charset=utf-8"
  ".webp" = "image/webp"
}

function Get-ContentType {
  param(
    [string]$Path
  )

  $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  if ($mimeTypes.ContainsKey($extension)) {
    return $mimeTypes[$extension]
  }

  return "application/octet-stream"
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$ReasonPhrase,
    [byte[]]$Body,
    [string]$ContentType = "text/plain; charset=utf-8",
    [switch]$HeadOnly
  )

  if ($null -eq $Body) {
    $Body = [byte[]]::new(0)
  }

  $headerText = @(
    "HTTP/1.1 $StatusCode $ReasonPhrase"
    "Content-Type: $ContentType"
    "Content-Length: $($Body.Length)"
    "Cache-Control: no-store"
    "Access-Control-Allow-Origin: *"
    "Access-Control-Allow-Methods: GET, HEAD, OPTIONS"
    "Access-Control-Allow-Headers: Content-Type"
    "Connection: close"
    ""
    ""
  ) -join "`r`n"

  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerText)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)

  if (-not $HeadOnly -and $Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }

  $Stream.Flush()
}

function Get-SafeFilePath {
  param(
    [string]$RequestPath
  )

  $pathOnly = ($RequestPath -split "\?", 2)[0]
  $decodedPath = [System.Uri]::UnescapeDataString($pathOnly)
  if ([string]::IsNullOrWhiteSpace($decodedPath) -or $decodedPath -eq "/") {
    $decodedPath = "/index.html"
  }

  $relativePath = $decodedPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
  $candidatePath = [System.IO.Path]::GetFullPath((Join-Path $resolvedRoot $relativePath))

  if (
    $candidatePath.Equals($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
    $candidatePath.StartsWith($rootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)
  ) {
    return $candidatePath
  }

  return $null
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse($BindAddress), $Port)
$listener.Start()

Write-Output "Gesture Particles server running at http://${BindAddress}:$Port"

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $null
    $reader = $null

    try {
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)

      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      while ($true) {
        $headerLine = $reader.ReadLine()
        if ($null -eq $headerLine -or $headerLine -eq "") {
          break
        }
      }

      $requestParts = $requestLine.Split(" ")
      if ($requestParts.Length -lt 2) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Bad Request")
        Send-Response -Stream $stream -StatusCode 400 -ReasonPhrase "Bad Request" -Body $body
        continue
      }

      $method = $requestParts[0].ToUpperInvariant()
      $requestPath = $requestParts[1]
      if ($method -eq "OPTIONS") {
        Send-Response -Stream $stream -StatusCode 204 -ReasonPhrase "No Content" -Body @()
        continue
      }

      if ($method -ne "GET" -and $method -ne "HEAD") {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Method Not Allowed")
        Send-Response -Stream $stream -StatusCode 405 -ReasonPhrase "Method Not Allowed" -Body $body
        continue
      }

      $filePath = Get-SafeFilePath -RequestPath $requestPath
      if (-not $filePath) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
        Send-Response -Stream $stream -StatusCode 403 -ReasonPhrase "Forbidden" -Body $body -HeadOnly:($method -eq "HEAD")
        continue
      }

      if (-not (Test-Path $filePath -PathType Leaf)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
        Send-Response -Stream $stream -StatusCode 404 -ReasonPhrase "Not Found" -Body $body -HeadOnly:($method -eq "HEAD")
        continue
      }

      $body = [System.IO.File]::ReadAllBytes($filePath)
      $contentType = Get-ContentType -Path $filePath
      Send-Response -Stream $stream -StatusCode 200 -ReasonPhrase "OK" -Body $body -ContentType $contentType -HeadOnly:($method -eq "HEAD")
    } catch {
      if ($stream) {
        try {
          $body = [System.Text.Encoding]::UTF8.GetBytes("Internal Server Error")
          Send-Response -Stream $stream -StatusCode 500 -ReasonPhrase "Internal Server Error" -Body $body
        } catch {
        }
      }
    } finally {
      if ($reader) {
        $reader.Dispose()
      }

      if ($stream) {
        $stream.Dispose()
      }

      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}