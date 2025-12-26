@echo off
setlocal

cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing dependencies...
  npm install
)

echo Starting dev server...
start "" http://localhost:5173
npm run dev

endlocal
