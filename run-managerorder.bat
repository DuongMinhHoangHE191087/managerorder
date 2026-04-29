@echo off
setlocal enabledelayedexpansion

rem ManagerOrder launcher for Windows
rem Usage:
rem   run-managerorder.bat
rem   run-managerorder.bat dev
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
  echo corepack khong co san trong PATH. Hay cai Node.js 22+ va bat corepack.
  popd >nul
  exit /b 1
)

if not exist "node_modules" (
  echo Dang cai dependencies...
  corepack pnpm install
  if errorlevel 1 (
    echo Cai dependencies that bai.
    popd >nul
    exit /b 1
  )
)

if /I "%CMD%"=="dev" goto dev
if /I "%CMD%"=="build" goto build
if /I "%CMD%"=="start" goto start
if /I "%CMD%"=="check" goto check

echo Lenh khong hop le: %CMD%
echo Su dung: %~nx0 [dev^|build^|start^|check]
popd >nul
exit /b 1

:dev
echo Dang chay moi truong dev...
corepack pnpm dev
set "EXITCODE=%ERRORLEVEL%"
popd >nul
exit /b %EXITCODE%

:build
echo Dang build toan bo monorepo...
corepack pnpm build
set "EXITCODE=%ERRORLEVEL%"
popd >nul
exit /b %EXITCODE%

:start
echo Dang chay production preview cho admin-web...
corepack pnpm --filter @managerorder/admin-web start
set "EXITCODE=%ERRORLEVEL%"
popd >nul
exit /b %EXITCODE%

:check
echo Dang chay release gate...
corepack pnpm check
set "EXITCODE=%ERRORLEVEL%"
popd >nul
exit /b %EXITCODE%
