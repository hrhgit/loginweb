@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo      STARTING PRODUCTION SIMULATION
echo ==========================================

:: 1. 确保依赖是最新的
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)

:: 2. 执行打包构建 (这一步最重要，检查代码能不能过编译)
echo.
echo [Step 1/2] Building for production...
call npm run build

:: 检查构建有没有报错，如果有错直接暂停，别往下跑了
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed! Please check the errors above.
    pause
    exit /b %errorlevel%
)

:: 3. 启动预览服务器
echo.
echo [Step 2/2] Build success! Starting preview server...
echo.
echo NOTE: This is the PRODUCTION build.
echo HMR (Hot updates) is disabled. You cannot edit code in real-time.
echo.

:: 这里的端口 4173 是 Vite preview 的默认端口
start "" http://localhost:4173

:: 启动预览
call npm run preview

endlocal