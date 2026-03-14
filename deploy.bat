@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ============================================================
:: Shopee Cloud Optimizer - Windows 自動部署腳本
:: 功能：執行測試 → 型別檢查 → 建置 → 部署 Vercel → AI 生成說明
:: 用法：deploy.bat [production|preview]
::       production  正式環境（預設）
::       preview     預覽環境
:: ============================================================

set "VERSION=1.0.0"
set "APP_NAME=Shopee Cloud Optimizer"
set "LOG_DIR=logs"
set "TIMESTAMP=%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%"
set "TIMESTAMP=!TIMESTAMP: =0!"
set "LOG_FILE=%LOG_DIR%\deploy_!TIMESTAMP!.log"

:: 部署模式（production / preview）
set "DEPLOY_MODE=production"
if /i "%~1"=="preview" set "DEPLOY_MODE=preview"

:: ============================================================
:: 工具函式：有顏色的輸出
:: ============================================================
goto :MAIN

:log_info
    echo [INFO] %~1
    echo [INFO] %~1 >> "%LOG_FILE%"
    goto :eof

:log_ok
    echo [ OK ] %~1
    echo [ OK ] %~1 >> "%LOG_FILE%"
    goto :eof

:log_warn
    echo [WARN] %~1
    echo [WARN] %~1 >> "%LOG_FILE%"
    goto :eof

:log_error
    echo [FAIL] %~1
    echo [FAIL] %~1 >> "%LOG_FILE%"
    goto :eof

:section
    echo.
    echo ============================================================
    echo  %~1
    echo ============================================================
    echo. >> "%LOG_FILE%"
    echo ============================================================ >> "%LOG_FILE%"
    echo  %~1 >> "%LOG_FILE%"
    echo ============================================================ >> "%LOG_FILE%"
    goto :eof

:abort
    echo.
    call :log_error "部署中止：%~1"
    echo.
    echo 詳細錯誤記錄：%LOG_FILE%
    pause
    exit /b 1

:: ============================================================
:MAIN
:: ============================================================

mkdir "%LOG_DIR%" 2>nul

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   %APP_NAME%   ║
echo  ║   自動部署腳本 v%VERSION%                    ║
echo  ║   模式：%-10s                        ║
echo  ╚══════════════════════════════════════════╝
echo  部署模式：%DEPLOY_MODE%
echo  時間戳記：%TIMESTAMP%
echo  日誌檔案：%LOG_FILE%
echo.

echo 部署開始時間：%DATE% %TIME% > "%LOG_FILE%"
echo 部署模式：%DEPLOY_MODE% >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"

:: ============================================================
call :section "步驟 1/6  前置環境檢查"
:: ============================================================

:: 確認 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    call :abort "找不到 Node.js，請先安裝 Node.js 20+"
)
for /f "tokens=*" %%v in ('node --version') do set "NODE_VER=%%v"
call :log_ok "Node.js %NODE_VER% 已安裝"

:: 確認 npm
npm --version >nul 2>&1
if errorlevel 1 (
    call :abort "找不到 npm"
)
for /f "tokens=*" %%v in ('npm --version') do set "NPM_VER=%%v"
call :log_ok "npm v%NPM_VER% 已安裝"

:: 確認 .env.local 存在
if not exist ".env.local" (
    call :log_warn ".env.local 不存在，請複製 .env.local.example 並填入實際值"
    call :log_warn "cp .env.local.example .env.local"
    call :abort "缺少 .env.local 環境設定檔"
)
call :log_ok ".env.local 已存在"

:: 讀取並驗證必要環境變數
set "MISSING_VARS="

for /f "usebackq tokens=1,* delims==" %%a in (`findstr /v "^#" .env.local`) do (
    set "KEY=%%a"
    set "VAL=%%b"
    set "KEY=!KEY: =!"
    if "!KEY!"=="NEXT_PUBLIC_SUPABASE_URL" (
        if "!VAL!"=="" set "MISSING_VARS=!MISSING_VARS! NEXT_PUBLIC_SUPABASE_URL"
        if "!VAL!"=="https://xxxx.supabase.co" set "MISSING_VARS=!MISSING_VARS! NEXT_PUBLIC_SUPABASE_URL"
    )
    if "!KEY!"=="ANTHROPIC_API_KEY" (
        if "!VAL!"=="" set "MISSING_VARS=!MISSING_VARS! ANTHROPIC_API_KEY"
        if "!VAL!"=="sk-ant-xxxx" set "MISSING_VARS=!MISSING_VARS! ANTHROPIC_API_KEY"
    )
    if "!KEY!"=="BROWSERBASE_API_KEY" (
        if "!VAL!"=="" set "MISSING_VARS=!MISSING_VARS! BROWSERBASE_API_KEY"
        if "!VAL!"=="bb_live_xxxx" set "MISSING_VARS=!MISSING_VARS! BROWSERBASE_API_KEY"
    )
)

if not "!MISSING_VARS!"=="" (
    call :log_error "以下環境變數尚未設定：!MISSING_VARS!"
    call :abort "請編輯 .env.local 填入正確的 API 金鑰"
)
call :log_ok "環境變數驗證通過"

:: ============================================================
call :section "步驟 2/6  安裝 / 更新相依套件"
:: ============================================================

call :log_info "執行 npm ci（使用 package-lock.json 確保版本一致）..."
npm ci >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    call :log_warn "npm ci 失敗，嘗試 npm install..."
    npm install >> "%LOG_FILE%" 2>&1
    if errorlevel 1 call :abort "套件安裝失敗，請檢查 %LOG_FILE%"
)
call :log_ok "套件安裝完成"

:: ============================================================
call :section "步驟 3/6  程式碼品質檢查"
:: ============================================================

:: TypeScript 型別檢查
call :log_info "執行 TypeScript 型別檢查..."
npm run typecheck >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    call :abort "TypeScript 型別錯誤，請修正後再部署（詳見 %LOG_FILE%）"
)
call :log_ok "TypeScript 型別檢查通過"

:: ESLint 程式碼風格
call :log_info "執行 ESLint 檢查..."
npm run lint >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    call :log_warn "ESLint 發現警告，建議修正但不阻斷部署"
)
call :log_ok "Lint 檢查完成"

:: ============================================================
call :section "步驟 4/6  執行單元測試"
:: ============================================================

call :log_info "執行 Jest 測試套件..."
npm run test:ci >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    call :abort "測試失敗！不允許部署失敗的程式碼（詳見 %LOG_FILE%）"
)
call :log_ok "所有測試通過"

:: ============================================================
call :section "步驟 5/6  建置正式版本"
:: ============================================================

call :log_info "執行 Next.js 建置（這可能需要 1-3 分鐘）..."
npm run build >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    call :abort "Next.js 建置失敗，請檢查 %LOG_FILE%"
)
call :log_ok "建置成功"

:: ============================================================
call :section "步驟 6/6  部署至 Vercel"
:: ============================================================

:: 確認 Vercel CLI
call :log_info "確認 Vercel CLI..."
npx vercel --version >nul 2>&1
if errorlevel 1 (
    call :log_info "安裝 Vercel CLI..."
    npm install -g vercel >> "%LOG_FILE%" 2>&1
)

:: 執行部署
if /i "%DEPLOY_MODE%"=="production" (
    call :log_info "部署至正式環境 (--prod)..."
    npx vercel --prod --yes > "%LOG_DIR%\vercel_output.tmp" 2>&1
) else (
    call :log_info "部署至預覽環境..."
    npx vercel --yes > "%LOG_DIR%\vercel_output.tmp" 2>&1
)

if errorlevel 1 (
    type "%LOG_DIR%\vercel_output.tmp" >> "%LOG_FILE%"
    call :abort "Vercel 部署失敗，請確認已登入（npx vercel login）"
)

:: 取得部署網址
set "DEPLOY_URL="
for /f "tokens=*" %%u in ('findstr /i "https://" "%LOG_DIR%\vercel_output.tmp"') do (
    set "DEPLOY_URL=%%u"
)
type "%LOG_DIR%\vercel_output.tmp" >> "%LOG_FILE%"
del "%LOG_DIR%\vercel_output.tmp" 2>nul

call :log_ok "Vercel 部署成功！"
if not "!DEPLOY_URL!"=="" (
    call :log_ok "部署網址：!DEPLOY_URL!"
)

:: ============================================================
call :section "🤖  AI 自動生成部署說明"
:: ============================================================

call :log_info "呼叫 Claude AI 生成此次部署說明..."
set "NOTES_FILE=deploy-notes_%TIMESTAMP%.txt"

node scripts/generate-release-notes.mjs "!DEPLOY_URL!" "!NOTES_FILE!"
if errorlevel 1 (
    call :log_warn "AI 說明生成失敗（不影響部署結果）"
) else (
    call :log_ok "部署說明已儲存至 logs\!NOTES_FILE!"
)

:: ============================================================
call :section "✅  部署完成"
:: ============================================================

echo.
echo  ┌─────────────────────────────────────────┐
echo  │  部署結果摘要                            │
echo  ├─────────────────────────────────────────┤
echo  │  狀態：SUCCESS                          │
echo  │  模式：%DEPLOY_MODE%                      │
echo  │  時間：%DATE% %TIME:~0,8%               │
if not "!DEPLOY_URL!"=="" (
    echo  │  網址：!DEPLOY_URL!
)
echo  │  日誌：%LOG_FILE%        │
echo  └─────────────────────────────────────────┘
echo.

call :log_info "完整部署日誌：%LOG_FILE%"

endlocal
pause
