@echo off
rem Runs the app from source (no build needed). Requires: pip install -r requirements.txt
cd /d "%~dp0"
start "" pythonw app.py
