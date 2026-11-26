# Driftwave local launcher for Windows. Uses only built-in Windows PowerShell; nothing to install.
# Serves the app folder at http://localhost:8517/ (this PC only) and opens your browser.
#   -NoBrowser : just start the server (used by the optional "start when I sign in" shortcut)
param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$port = 8517
$url = "http://localhost:$port/"

# Already running? Then just open it. (Always using the same port keeps your saved presets.)
try {
  $r = Invoke-WebRequest -Uri ($url + 'manifest.webmanifest') -UseBasicParsing -TimeoutSec 2
  if ($r.Content -match 'Driftwave') {
    if (-not $NoBrowser) { Start-Process $url }
    exit 0
  }
} catch { }

$root = Join-Path $PSScriptRoot 'app'
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.json'='application/json'; '.webmanifest'='application/manifest+json'; '.svg'='image/svg+xml'; '.png'='image/png';
  '.ogg'='audio/ogg'; '.txt'='text/plain'; '.ico'='image/x-icon' }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)
try { $listener.Start() } catch {
  Write-Host "Port $port is being used by another program, so Driftwave can't start."
  Read-Host 'Press Enter to close'; exit 1
}

$host.UI.RawUI.WindowTitle = 'Driftwave (close this window to quit)'
Write-Host ''
Write-Host "  Driftwave is running at $url"
Write-Host '  Keep this window open (you can minimize it). Close it to quit.'
Write-Host ''
if (-not $NoBrowser) { Start-Process $url }

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
