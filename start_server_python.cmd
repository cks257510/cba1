@echo off
setlocal
cd /d "%~dp0"
echo Starting Python server on http://127.0.0.1:8080
start "" "http://127.0.0.1:8080/index.html"
py -3 -m http.server 8080 --bind 127.0.0.1
if %errorlevel% neq 0 (
  python -m http.server 8080 --bind 127.0.0.1
)
pause
