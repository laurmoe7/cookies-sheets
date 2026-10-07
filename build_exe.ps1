# Builds a standalone Windows app into dist\Pathfinder Sheet\ (run "Pathfinder Sheet.exe").
# Usage:  powershell -ExecutionPolicy Bypass -File build_exe.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

python -m pip install --quiet -r requirements.txt

if (-not (Test-Path 'data\pf1e.db')) {
    Write-Host 'Building game data...'
    python tools\build_data.py
}

# Developer tools (web\dev) are for the author only: build from a copy of web without them
$stage = Join-Path $env:TEMP 'pf_web_dist'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
robocopy web $stage /E /XD dev /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw 'Could not stage the web folder' }

python -m PyInstaller --noconfirm --clean --windowed --onedir `
    --name 'Pathfinder Sheet' `
    --icon 'web\icon.ico' `
    --add-data "$stage;web" `
    --add-data 'data;data' `
    app.py

Copy-Item 'tools\dist_readme.txt' 'dist\Pathfinder Sheet\READ ME FIRST.txt'

Write-Host ''
Write-Host 'Done. Run: dist\Pathfinder Sheet\Pathfinder Sheet.exe'
