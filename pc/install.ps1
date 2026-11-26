# Driftwave installer for Windows (current user only, no admin needed).
# Copies Driftwave to %LOCALAPPDATA%\Programs\Driftwave and adds Start menu + desktop shortcuts.
# You can delete the downloaded folder afterwards.
$ErrorActionPreference = 'Stop'
$log = Join-Path $env:TEMP 'driftwave-install.log'
try { Start-Transcript -Path $log -Force | Out-Null } catch { }
trap {
  Write-Host ''
  Write-Host "  Something went wrong: $_" -ForegroundColor Red
  Write-Host "  Details were saved to: $log"
  try { Stop-Transcript | Out-Null } catch { }
  Read-Host 'Press Enter to close'; exit 1
}
$src  = $PSScriptRoot
$dest = Join-Path $env:LOCALAPPDATA 'Programs\Driftwave'

Write-Host ''
Write-Host '  Installing Driftwave...'
Write-Host "  From: $src"
Write-Host "  To:   $dest"
Write-Host ''

if (-not (Test-Path (Join-Path $src 'app\index.html'))) {
  Write-Host '  Could not find the "app" folder next to this installer.'
  Write-Host '  Unzip the whole Driftwave-PC.zip first, then run the installer from the unzipped folder.'
  Read-Host 'Press Enter to close'; exit 1
}

if ([System.IO.Path]::GetFullPath($src).TrimEnd('\') -ne [System.IO.Path]::GetFullPath($dest).TrimEnd('\')) {
  if (Test-Path $dest) { Remove-Item (Join-Path $dest 'app') -Recurse -Force -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
  Copy-Item (Join-Path $src 'app') $dest -Recurse -Force
  foreach ($f in 'server.ps1', 'driftwave.ico', 'uninstall.ps1', 'Uninstall Driftwave.bat', 'READ ME FIRST.txt') {
    if (Test-Path (Join-Path $src $f)) { Copy-Item (Join-Path $src $f) $dest -Force }
  }
}

$ps   = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$wsh  = New-Object -ComObject WScript.Shell
function New-DriftwaveShortcut([string]$path, [string]$extraArgs) {
  $s = $wsh.CreateShortcut($path)
  $s.TargetPath = $ps
  $s.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$dest\server.ps1`" $extraArgs"
  $s.WorkingDirectory = $dest
  $s.IconLocation = "$dest\driftwave.ico,0"
  $s.WindowStyle = 7   # start minimized
  $s.Description = 'Driftwave ambient sounds'
  $s.Save()
}

$startMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Driftwave.lnk'
$desktop   = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Driftwave.lnk'
New-DriftwaveShortcut $startMenu ''
New-DriftwaveShortcut $desktop ''
Write-Host '  [OK] Start menu shortcut: search "Driftwave" in Start'
Write-Host '  [OK] Desktop shortcut'

$startup = Join-Path ([Environment]::GetFolderPath('Startup')) 'Driftwave.lnk'
Write-Host ''
$ans = Read-Host '  Start Driftwave automatically when you sign in to Windows? (y/N)'
if ($ans -match '^[yY]') {
  New-DriftwaveShortcut $startup '-NoBrowser'
  Write-Host '  [OK] Driftwave will start (minimized, in the background) when you sign in.'
} elseif (Test-Path $startup) {
  Remove-Item $startup -Force
}

if (-not (Test-Path $startMenu)) { throw "The Start menu shortcut was not created at $startMenu" }
Write-Host ''
Write-Host '  Done! Driftwave is now in your Start menu under "All apps" (or search "Driftwave").'
Write-Host ''
Write-Host '  Windows does not let programs pin themselves, so pin it yourself:'
Write-Host '  a folder will open with "Driftwave" selected. Right-click it, then choose'
Write-Host '  "Pin to Start" (or "Show more options" > "Pin to taskbar" on Windows 11).'
Write-Host ''
Start-Process explorer.exe -ArgumentList "/select,`"$startMenu`""
try { Stop-Transcript | Out-Null } catch { }
$open = Read-Host '  Open Driftwave now? (Y/n)'
if ($open -notmatch '^[nN]') { Start-Process $ps -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$dest\server.ps1`"" -WindowStyle Minimized }
