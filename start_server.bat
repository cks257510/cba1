@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo Character PVP Local Server
echo ========================================
echo.
echo This launcher will try:
echo 1. PowerShell static server
echo 2. Python server
echo.
echo If Windows asks for permission, allow local network access.
echo.

where powershell >nul 2>nul
if %errorlevel%==0 (
  echo Starting PowerShell server on http://127.0.0.1:8080 ...
  start "Character PVP PowerShell Server" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
  timeout /t 3 /nobreak >nul
  start "" "http://127.0.0.1:8080/index.html"
  exit /b
)

where py >nul 2>nul
if %errorlevel%==0 (
  echo Starting Python server on http://127.0.0.1:8080 ...
  start "Character PVP Python Server" cmd /k "cd /d ""%~dp0"" && py -3 -m http.server 8080 --bind 127.0.0.1"
  timeout /t 3 /nobreak >nul
  start "" "http://127.0.0.1:8080/index.html"
  exit /b
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo Starting Python server on http://127.0.0.1:8080 ...
  start "Character PVP Python Server" cmd /k "cd /d ""%~dp0"" && python -m http.server 8080 --bind 127.0.0.1"
  timeout /t 3 /nobreak >nul
  start "" "http://127.0.0.1:8080/index.html"
  exit /b
)

echo.
echo No PowerShell or Python was found.
echo Open offline_demo.html for UI-only demo mode.
echo For online Firebase mode, upload this folder to GitHub Pages.
echo.
pause
