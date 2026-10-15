@echo off
rem Runs Cookie's Sheets in your web browser instead of its own window. A small icon appears in the notification area (next to the clock):
rem The app closes by itself a few seconds after you close the page. Right-click the icon and choose Quit to close it sooner.
cd /d "%~dp0"
start "" "Cookie's Sheets.exe" --web
