# Builds a standalone Windows app into dist\Pathfinder Sheet\ (run "Pathfinder Sheet.exe").
# Usage:  powershell -ExecutionPolicy Bypass -File build_exe.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

python -m pip install --quiet -r requirements.txt

if (-not (Test-Path 'data\pf1e.db')) {
    Write-Host 'Building game data...'
    python tools\build_data.py
}

python -m PyInstaller --noconfirm --clean --windowed --onedir `
    --name 'Pathfinder Sheet' `
    --icon 'web\icon.ico' `
    --add-data 'web;web' `
    --add-data 'data;data' `
    app.py

Write-Host ''
Write-Host 'Done. Run: dist\Pathfinder Sheet\Pathfinder Sheet.exe'
