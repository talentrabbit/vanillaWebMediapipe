param(
  [Parameter(Mandatory = $true)]
  [string]$Root,

  [int]$Port = 8080,

  [string]$BindAddress = "0.0.0.0",

  [switch]$Secure
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
    [System.IO.Stream]$Stream,
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

$sslCert = $null
if ($Secure) {
  $hostName = [System.Net.Dns]::GetHostName()
  $caFile = Join-Path $PSScriptRoot "gesture-particles-dev-ca.pfx"
  $caSubject = "CN=Gesture Particles Local CA"
  $rootCert = $null

  if (Test-Path $caFile) {
    $rootCert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($caFile, "", [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)
  }

  if (-not $rootCert) {
    $rootKey = [System.Security.Cryptography.RSA]::Create(4096)
    $rootReq = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
      $caSubject,
      $rootKey,
      [System.Security.Cryptography.HashAlgorithmName]::SHA256,
      [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
    )

    $rootReq.CertificateExtensions.Add(
      [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true, $true, 0, $true)
    )
    $rootReq.CertificateExtensions.Add(
      [System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
        ([System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign -bor [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::CrlSign),
        $true
      )
    )
    $rootReq.CertificateExtensions.Add(
      [System.Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new($rootReq.PublicKey, $false)
    )

    $rootCert = $rootReq.CreateSelfSigned([datetime]::UtcNow.AddDays(-1), [datetime]::UtcNow.AddYears(10))
    $rootCert = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::CopyWithPrivateKey($rootCert, $rootKey)
    $rootCert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
      $rootCert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, ""),
      "",
      [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable
    )

    [System.IO.File]::WriteAllBytes($caFile, $rootCert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, ""))
  }

  $rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store([System.Security.Cryptography.X509Certificates.StoreName]::Root, [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser)
  $rootStore.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
  $existingRoot = $rootStore.Certificates | Where-Object { $_.Subject -eq $caSubject }
  if (-not $existingRoot) {
    $rootStore.Add([System.Security.Cryptography.X509Certificates.X509Certificate2]::new($rootCert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)))
  }
  $rootStore.Close()

  $sanBuilder = New-Object System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder
  $sanBuilder.AddDnsName("localhost")
  $sanBuilder.AddDnsName($hostName)
  $sanBuilder.AddIpAddress([System.Net.IPAddress]::Loopback)
  $sanBuilder.AddIpAddress([System.Net.IPAddress]::IPv6Loopback)
  foreach ($address in [System.Net.Dns]::GetHostAddresses($hostName) | Where-Object { $_.AddressFamily -eq 'InterNetwork' -or $_.AddressFamily -eq 'InterNetworkV6' }) {
    $sanBuilder.AddIpAddress($address)
  }

  $key = [System.Security.Cryptography.RSA]::Create(2048)
  $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
    "CN=$hostName",
    $key,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
  )

  $request.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $false)
  )
  $request.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
      ([System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment),
      $false
    )
  )
  $request.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new($request.PublicKey, $false)
  )
  $request.CertificateExtensions.Add($sanBuilder.Build())

  $sslCert = $request.Create($rootCert, [datetime]::UtcNow.AddDays(-1), [datetime]::UtcNow.AddYears(1), [byte[]]@(0x01,0x00,0x00,0x00))
  $sslCert = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::CopyWithPrivateKey($sslCert, $key)
  $sslCert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
    $sslCert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, ""),
    "",
    [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable
  )
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse($BindAddress), $Port)
$listener.Start()

$scheme = "http"
if ($Secure.IsPresent) { $scheme = "https" }
Write-Output "Gesture Particles server running at {$scheme}://${BindAddress}:$Port"

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $netStream = $client.GetStream()
    $stream = $netStream
    $sslStream = $null
    $reader = $null

    try {
      if ($Secure) {
        $sslStream = New-Object System.Net.Security.SslStream($netStream, $false)
        $sslProtocols = [System.Security.Authentication.SslProtocols]::Tls12
        if ([Enum]::IsDefined([System.Security.Authentication.SslProtocols], "Tls13")) {
          $sslProtocols = $sslProtocols -bor [System.Security.Authentication.SslProtocols]::Tls13
        }

        try {
          $sslStream.AuthenticateAsServer($sslCert, $false, $sslProtocols, $false)
          $stream = $sslStream
        } catch {
          Write-Host "SSL auth failed: $($_.Exception.Message)"
          if ($_.Exception.InnerException) {
            Write-Host "  Inner: $($_.Exception.InnerException.Message)"
          }
          $sslStream.Dispose()
          $client.Close()
          continue
        }
      }

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

      if ($sslStream) {
        $sslStream.Dispose()
      } elseif ($stream) {
        $stream.Dispose()
      }

      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}