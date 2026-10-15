@echo off
rem Runs the app from source (no build needed). Requires: pip install -r requirements.txt
rem With .launcher\Cookie's Sheets.exe (made by: python tools\brand.py launcher) Task Manager lists the app as "Cookie's Sheets" with its icon.
cd /d "%~dp0"
if exist ".launcher\Cookie's Sheets.exe" (
  start "" ".launcher\Cookie's Sheets.exe" app.py
) else (
  start "" pythonw app.py
)
