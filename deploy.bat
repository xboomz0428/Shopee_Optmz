@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: 切換到腳本所在目錄（避免從其他位置執行時路徑錯誤）
cd /d "%~dp0"

:: ============================================================
:: Shopee Cloud Optimizer - Windows 自動部署腳本
:: ============================================================

set "VERSION=1.0.0"
set "LOG_DIR=logs"

for /f "tokens=1-3 delims=/" %%a in ("%DATE%") do set "D=%%a%%b%%c"
for /f "tokens=1-3 delims=:." %%a in ("%TIME: =0%") do set "T=%%a%%b%%c"
set "TIMESTAMP=%D%_%T%"
set "LOG_FILE=%LOG_DIR%\deploy_%TIMESTAMP%.log"

set "DEPLOY_MODE=production"
if /i "%~1"=="preview" set "DEPLOY_MODE=preview"

goto :MAIN

:: ============================================================
:: 工具函式
:: ============================================================
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
    echo   %~1
    echo ============================================================
    echo. >> "%LOG_FILE%"
    echo ============================================================ >> "%LOG_FILE%"
    echo   %~1 >> "%LOG_FILE%"
    echo ============================================================ >> "%LOG_FILE%"
    goto :eof

:confirm
    echo.
    echo  [?] %~1
    echo      按 Enter 繼續，或按 Ctrl+C 取消...
    pause >nul
    goto :eof

:abort
    echo.
    call :log_error "部署中止：%~1"
    echo.
    echo  詳細錯誤記錄：%LOG_FILE%
    echo.
    echo  按任意鍵關閉視窗...
    pause >nul
    exit /b 1

:: ============================================================
:MAIN
:: ============================================================

mkdir "%LOG_DIR%" 2>nul

echo.
echo  ============================================================
echo   Shopee Cloud Optimizer - 自動部署腳本 v%VERSION%
echo  ============================================================
echo   模式：%DEPLOY_MODE%
echo   時間：%DATE% %TIME%
echo   日誌：%LOG_FILE%
echo  ============================================================
echo.
echo  按 Enter 開始部署，或按 Ctrl+C 取消...
pause >nul

echo 部署開始：%DATE% %TIME% > "%LOG_FILE%"
echo 部署模式：%DEPLOY_MODE% >> "%LOG_FILE%"

:: ============================================================
call :section "步驟 1/6  前置環境檢查"
:: ============================================================

node --version >nul 2>&1
if errorlevel 1 call :abort "找不到 Node.js，請先安裝 Node.js 20+"
for /f "tokens=*" %%v in ('node --version') do set "NODE_VER=%%v"
call :log_ok "Node.js %NODE_VER% 已安裝"

npm --version >nul 2>&1
if errorlevel 1 call :abort "找不到 npm"
call :log_ok "npm 已安裝"

if not exist ".env.local" (
    call :abort ".env.local 不存在，請先執行：npx vercel env pull .env.local"
)
call :log_ok ".env.local 已存在"

set "MISSING_VARS="
for /f "usebackq tokens=1,* delims==" %%a in (`findstr /v "^#" .env.local`) do (
    set "KEY=%%a"
    set "VAL=%%b"
    set "KEY=!KEY: =!"
    if "!KEY!"=="NEXT_PUBLIC_SUPABASE_URL" (
        if "!VAL!"=="" set "MISSING_VARS=!MISSING_VARS! NEXT_PUBLIC_SUPABASE_URL"
        if "!VAL!"=="https://xxxx.supabase.co" set "MISSING_VARS=!MISSING_VARS! NEXT_PUBLIC_SUPABASE_URL"
    )
    if "!KEY!"=="GOOGLE_AI_API_KEY" (
        if "!VAL!"=="" set "MISSING_VARS=!MISSING_VARS! GOOGLE_AI_API_KEY"
        if "!VAL!"=="AIzaSy..." set "MISSING_VARS=!MISSING_VARS! GOOGLE_AI_API_KEY"
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

echo.
echo  *** 步驟 1 完成：環境檢查通過 ***
call :confirm "繼續安裝套件？"

:: ============================================================
call :section "步驟 2/6  安裝相依套件"
:: ============================================================

call :log_info "執行 npm ci..."
npm ci >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    call :log_warn "npm ci 失敗，嘗試 npm install..."
    npm install >> "%LOG_FILE%" 2>&1
    if errorlevel 1 call :abort "套件安裝失敗，請檢查 %LOG_FILE%"
)
call :log_ok "套件安裝完成"

echo.
echo  *** 步驟 2 完成：套件安裝成功 ***
call :confirm "繼續執行程式碼檢查？"

:: ============================================================
call :section "步驟 3/6  程式碼品質檢查"
:: ============================================================

call :log_info "TypeScript 型別檢查..."
npm run typecheck >> "%LOG_FILE%" 2>&1
if errorlevel 1 call :abort "TypeScript 型別錯誤，請修正後再部署（詳見 %LOG_FILE%）"
call :log_ok "TypeScript 檢查通過"

call :log_info "ESLint 檢查..."
npm run lint >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    call :log_warn "ESLint 有警告，建議修正但不阻斷部署"
) else (
    call :log_ok "ESLint 通過"
)

echo.
echo  *** 步驟 3 完成：程式碼品質檢查通過 ***
call :confirm "繼續執行單元測試？"

:: ============================================================
call :section "步驟 4/6  執行單元測試"
:: ============================================================

call :log_info "執行 Jest 測試..."
npm run test:ci
if errorlevel 1 call :abort "測試失敗，不允許部署（詳見 %LOG_FILE%）"
call :log_ok "所有測試通過"

echo.
echo  *** 步驟 4 完成：所有測試通過 ***
call :confirm "繼續建置正式版本？（約需 1-3 分鐘）"

:: ============================================================
call :section "步驟 5/6  建置正式版本"
:: ============================================================

call :log_info "執行 next build..."
npm run build
if errorlevel 1 call :abort "建置失敗（詳見 %LOG_FILE%）"
call :log_ok "建置成功"

echo.
echo  *** 步驟 5 完成：建置成功 ***
echo.
echo  即將部署至 Vercel %DEPLOY_MODE% 環境
call :confirm "確認部署？"

:: ============================================================
call :section "步驟 6/6  部署至 Vercel"
:: ============================================================

if /i "%DEPLOY_MODE%"=="production" (
    call :log_info "部署至正式環境..."
    npx vercel --prod --yes 2>&1 | tee "%LOG_DIR%\vercel_output.tmp"
) else (
    call :log_info "部署至預覽環境..."
    npx vercel --yes 2>&1 | tee "%LOG_DIR%\vercel_output.tmp"
)

if errorlevel 1 (
    call :abort "Vercel 部署失敗，請確認已登入（npx vercel login）"
)

set "DEPLOY_URL="
for /f "tokens=*" %%u in ('findstr /i "Aliased:" "%LOG_DIR%\vercel_output.tmp" 2^>nul') do (
    set "LINE=%%u"
    set "DEPLOY_URL=!LINE:Aliased: =!"
)
type "%LOG_DIR%\vercel_output.tmp" >> "%LOG_FILE%" 2>nul
del "%LOG_DIR%\vercel_output.tmp" 2>nul

call :log_ok "Vercel 部署成功！"
if not "!DEPLOY_URL!"=="" call :log_ok "部署網址：!DEPLOY_URL!"

:: ============================================================
call :section "AI 自動生成部署說明"
:: ============================================================

call :log_info "呼叫 Google Gemini 生成部署說明..."
set "NOTES_FILE=deploy-notes_%TIMESTAMP%.txt"
node scripts/generate-release-notes.mjs "!DEPLOY_URL!" "!NOTES_FILE!"
if errorlevel 1 (
    call :log_warn "AI 說明生成失敗（不影響部署結果）"
) else (
    call :log_ok "部署說明已儲存至 %LOG_DIR%\!NOTES_FILE!"
)

:: ============================================================
call :section "部署完成"
:: ============================================================

echo.
echo  ============================================================
echo   狀態  : SUCCESS
echo   模式  : %DEPLOY_MODE%
echo   時間  : %DATE% %TIME%
if not "!DEPLOY_URL!"=="" echo   網址  : !DEPLOY_URL!
echo   日誌  : %LOG_FILE%
echo  ============================================================
echo.
echo  按任意鍵關閉視窗...
pause >nul

endlocal
