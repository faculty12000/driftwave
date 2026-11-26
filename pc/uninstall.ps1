# Removes Driftwave's shortcuts and its program folder. Your browser keeps any saved presets
# unless you clear its site data for localhost:8517.
$dest = Join-Path $env:LOCALAPPDATA 'Programs\Driftwave'
foreach ($p in @(
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'Driftwave.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Driftwave.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Startup')) 'Driftwave.lnk'))) {
  if (Test-Path $p) { Remove-Item $p -Force }
}
Write-Host 'Shortcuts removed. Close any open Driftwave window, then press Enter to delete the program folder.'
Read-Host | Out-Null
Set-Location $env:TEMP
Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path $dest) { Write-Host "Some files are still in use. Close Driftwave and delete $dest manually." }
else { Write-Host 'Driftwave has been uninstalled.' }
Read-Host 'Press Enter to close' | Out-Null
