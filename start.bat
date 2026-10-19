@echo off
cd /d "%~dp0"
where npm >nul 2>nul || (echo Node.js가 필요해요. https://nodejs.org 에서 LTS 버전을 설치해 주세요. & pause & exit /b)
if not exist node_modules call npm install
call npm run dev
