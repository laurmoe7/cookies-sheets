# Builds a standalone Windows app into dist\Cookie's Sheets\ (run "Cookie's Sheets.exe").
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

# The name and version Windows (Task Manager, file properties) shows for the .exe
python tools\brand.py version-file build\version_info.txt

python -m PyInstaller --noconfirm --clean --windowed --onedir `
    --name "Cookie's Sheets" `
    --exclude-module setuptools --exclude-module pkg_resources `
    --icon 'web\icon.ico' `
    --version-file 'build\version_info.txt' `
    --add-data "$stage;web" `
    --add-data 'data;data' `
    app.py

Copy-Item 'tools\dist_readme.txt' "dist\Cookie's Sheets\READ ME FIRST.txt"

Write-Host ''
Write-Host "Done. Run: dist\Cookie's Sheets\Cookie's Sheets.exe"
