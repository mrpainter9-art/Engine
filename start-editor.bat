@echo off
rem Double-click to open the editor. Optional: drag a game folder onto this file to open that project.
cd /d "%~dp0"
if not exist node_modules call npm install
if "%~1"=="" (call npm run editor -- --open) else (call npm run editor -- --open --project "%~1")
pause
