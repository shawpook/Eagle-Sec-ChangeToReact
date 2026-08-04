@echo off
title Eagle Reverse Dev
cd /d "%~dp0"
echo ========================================
echo   Eagle Reverse - Starting...
echo ========================================
echo.
npm run dev:electron
pause
