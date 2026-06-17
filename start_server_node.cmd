@echo off
setlocal
cd /d "%~dp0"
echo Character PVP Node Local Server
echo Keep this window open while playing.
echo Browser URL: http://localhost:3000
start "" "http://localhost:3000"
npx serve -l 3000
pause
