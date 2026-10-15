# Creates "Run Cookie's Sheets.lnk" (with the app icon) in the project folder.
# It runs the app from source without a console window. It uses .launcher\Cookie's Sheets.exe (made by tools\brand.py), so Task Manager lists the app
# as "Cookie's Sheets" with its icon; without that file it falls back to pythonw, which Task Manager shows as "Python".
# Usage:  powershell -ExecutionPolicy Bypass -File tools\make_shortcut.ps1 [-Desktop]
param([switch]$Desktop)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

# The branded launcher if there is one (python tools\brand.py launcher makes it), else a real pythonw.exe (not the Microsoft Store alias in WindowsApps).
$launcher = Join-Path $root ".launcher\Cookie's Sheets.exe"
if (Test-Path $launcher) { $pyw = [pscustomobject]@{ Source = $launcher } }
else {
    $pyw = Get-Command pythonw.exe -All -ErrorAction SilentlyContinue |
        Where-Object { $_.Source -notmatch '\\WindowsApps\\' } | Select-Object -First 1
    if (-not $pyw) { $pyw = Get-Command pythonw.exe -ErrorAction Stop }
}

$targets = @(Join-Path $root "Run Cookie's Sheets.lnk")
if ($Desktop) { $targets += Join-Path ([Environment]::GetFolderPath('Desktop')) "Cookie's Sheets.lnk" }

$shell = New-Object -ComObject WScript.Shell
foreach ($path in $targets) {
    $lnk = $shell.CreateShortcut($path)
    $lnk.TargetPath = $pyw.Source
    $lnk.Arguments = '"' + (Join-Path $root 'app.py') + '"'
    $lnk.WorkingDirectory = $root
    $lnk.IconLocation = (Join-Path $root 'web\icon.ico') + ',0'
    $lnk.Description = 'Pathfinder 1e character sheet'
    $lnk.Save()
    Write-Host "Created $path"
}
