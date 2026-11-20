# Driftwave local launcher for Windows. Uses only built-in Windows PowerShell; nothing to install.
# Serves the app folder at http://localhost:<port>/ (this PC only) and opens your browser.
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot 'app'
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.json'='application/json'; '.webmanifest'='application/manifest+json'; '.svg'='image/svg+xml'; '.png'='image/png';
  '.ogg'='audio/ogg'; '.txt'='text/plain'; '.ico'='image/x-icon' }

$listener = $null
foreach ($port in 8517..8530) {
  try {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$port/")
    $l.Start(); $listener = $l; break
  } catch { }
}
if (-not $listener) { Write-Host 'Could not find a free port (8517-8530).'; Read-Host 'Press Enter to close'; exit 1 }

$url = "http://localhost:$port/"
Write-Host ''
Write-Host "  Driftwave is running at $url"
Write-Host '  Keep this window open while you listen. Close it to quit.'
Write-Host ''
Start-Process $url

$rootFull = [System.IO.Path]::GetFullPath($root)
while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '') { $rel = 'index.html' }
    $file = [System.IO.Path]::GetFullPath((Join-Path $rootFull $rel))
    if ($file.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path $file -PathType Leaf)) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' })
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $res.StatusCode = 404 }
  } catch { $res.StatusCode = 500 }
  finally { try { $res.Close() } catch { } }
}
