@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ============================================================
:: Shopee Cloud Optimizer - 本機測試啟動腳本
:: 功能：安裝套件 → 建置 → 本機正式模式啟動
:: 用法：deploy-local.bat [dev|prod]
::       dev   開發模式，熱更新（預設）
::       prod  模擬正式環境
:: ============================================================

set "MODE=dev"
if /i "%~1"=="prod" set "MODE=prod"

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   Shopee Cloud Optimizer - 本機啟動     ║
echo  ╚══════════════════════════════════════════╝
echo  模式：%MODE%
echo.

:: 環境檢查
if not exist ".env.local" (
    echo [WARN] 找不到 .env.local，嘗試複製範本...
    if exist ".env.local.example" (
        copy ".env.local.example" ".env.local" >nul
        echo [WARN] 已複製 .env.local.example，請編輯填入正確的 API 金鑰！
        pause
    ) else (
        echo [FAIL] 找不到 .env.local.example，請手動建立 .env.local
        pause
        exit /b 1
    )
)

:: 安裝相依套件
echo [INFO] 安裝套件...
npm install
if errorlevel 1 (
    echo [FAIL] npm install 失敗
    pause
    exit /b 1
)

if /i "%MODE%"=="prod" (
    echo [INFO] 建置正式版本...
    npm run build
    if errorlevel 1 (
        echo [FAIL] 建置失敗
        pause
        exit /b 1
    )
    echo [INFO] 啟動正式版本伺服器...
    echo [ OK ] 開啟瀏覽器：http://localhost:3000
    npm run start
) else (
    echo [ OK ] 啟動開發伺服器：http://localhost:3000
    npm run dev
)

endlocal
