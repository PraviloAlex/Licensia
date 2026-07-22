@echo off
title Licencia AR — Dev Server
cd /d "%~dp0"
echo.
echo  Starting Licencia AR dev server...
echo  Open: http://localhost:5173
echo.

REM Clear vite cache if it causes issues
if exist "node_modules\.vite" (
    rmdir /s /q "node_modules\.vite" 2>nul
)

start "" "http://localhost:5173"
npx vite

echo.
echo  Server stopped.
pause
