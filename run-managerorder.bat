@echo off
setlocal enabledelayedexpansion

rem ManagerOrder launcher for Windows
rem Usage:
rem   run-managerorder.bat
rem   run-managerorder.bat dev
rem   run-managerorder.bat dev-classic  (Disable Turbopack - More stable on Windows)
rem   run-managerorder.bat clean        (Clear .next cache)
rem   run-managerorder.bat build
rem   run-managerorder.bat start
rem   run-managerorder.bat check

set "ROOT=%~dp0"
pushd "%ROOT%" >nul

if "%~1"=="" (
  set "CMD=dev"
) else (
  set "CMD=%~1"
)

where corepack >nul 2>nul
if errorlevel 1 (
  echo [ERROR] corepack khong co san trong PATH. Hay cai Node.js 22+ va bat corepack.
  popd >nul
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] Dang cai dependencies...
  corepack pnpm install
  if errorlevel 1 (
    echo [ERROR] Cai dependencies that bai.
    popd >nul
    exit /b 1
  )
)

if /I "%CMD%"=="dev" goto dev
if /I "%CMD%"=="dev-classic" goto dev_classic
if /I "%CMD%"=="clean" goto clean
if /I "%CMD%"=="build" goto build
if /I "%CMD%"=="start" goto start
if /I "%CMD%"=="check" goto check

echo [ERROR] Lenh khong hop le: %CMD%
echo Su dung: %~nx0 [dev^|dev-classic^|clean^|build^|start^|check]
popd >nul
exit /b 1

:dev
echo [INFO] Dang chay moi truong dev (Turbopack)...
corepack pnpm dev
set "EXITCODE=%ERRORLEVEL%"
popd >nul
exit /b %EXITCODE%

:dev_classic
echo [INFO] Dang chay moi truong dev (Classic Mode - No Turbopack)...
set "NEXT_TURBO=false"
corepack pnpm dev
set "EXITCODE=%ERRORLEVEL%"
popd >nul
exit /b %EXITCODE%

:clean
echo [INFO] Dang xoa cache .next...
if exist "apps\admin-web\.next" rd /s /q "apps\admin-web\.next"
echo [SUCCESS] Da don dep cache.
popd >nul
exit /b 0

:build
echo [INFO] Dang build toan bo monorepo...
corepack pnpm build
set "EXITCODE=%ERRORLEVEL%"
popd >nul
exit /b %EXITCODE%

:start
echo [INFO] Dang chay production preview cho admin-web...
corepack pnpm --filter @managerorder/admin-web start
set "EXITCODE=%ERRORLEVEL%"
popd >nul
exit /b %EXITCODE%

:check
echo [INFO] Dang chay release gate...
corepack pnpm check
set "EXITCODE=%ERRORLEVEL%"
popd >nul
exit /b %EXITCODE%
