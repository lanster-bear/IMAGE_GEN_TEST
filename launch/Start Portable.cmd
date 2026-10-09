@echo off
cd /d "%~dp0"
if not exist "Image Studio.exe" (
  echo Portable build is missing. Run npm run portable first.
  exit /b 1
)
start "" "%~dp0Image Studio.exe"
