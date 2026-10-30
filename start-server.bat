@echo off
title FinFlow Local Server
cd /d "%~dp0"
echo ========================================================
echo   Starting FinFlow Local HTTP Server on http://localhost:5000
echo ========================================================
echo.
echo Opening browser...
start http://localhost:5000
echo.
echo Press Ctrl+C in this window when you want to stop the server.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
