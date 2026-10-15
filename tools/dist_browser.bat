@echo off
rem Runs Cookie's Sheets in your web browser instead of its own window. A small icon appears in the notification area (next to the clock):
rem double-click it to open the page again, right-click it and choose Quit when you are done.
cd /d "%~dp0"
start "" "Cookie's Sheets.exe" --web
