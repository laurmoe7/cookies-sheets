# Creates "Run Cookie's Sheets.lnk" (with the app icon) in the project folder.
# It runs the app from source with pythonw, so no console window appears.
# Usage:  powershell -ExecutionPolicy Bypass -File tools\make_shortcut.ps1 [-Desktop]
param([switch]$Desktop)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

# Prefer a real pythonw.exe over the Microsoft Store alias in WindowsApps.
$pyw = Get-Command pythonw.exe -All -ErrorAction SilentlyContinue |
    Where-Object { $_.Source -notmatch '\\WindowsApps\\' } | Select-Object -First 1
if (-not $pyw) { $pyw = Get-Command pythonw.exe -ErrorAction Stop }

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
