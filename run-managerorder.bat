@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem ManagerOrder Windows launcher
rem Commands:
rem   run-managerorder.bat
rem   run-managerorder.bat dev
rem   run-managerorder.bat dev-classic
rem   run-managerorder.bat dev-turbo
rem   run-managerorder.bat start
rem   run-managerorder.bat build
rem   run-managerorder.bat check
rem   run-managerorder.bat clean
rem   run-managerorder.bat install
rem   run-managerorder.bat help

set "ROOT=%~dp0"
cd /d "%ROOT%" || goto fatal

set "CMD=%~1"
if not defined CMD set "CMD=dev"

where node >nul 2>nul
if errorlevel 1 call :fail "Khong tim thay Node.js trong PATH. Can Node.js 22.x tro len."

where npm >nul 2>nul
if errorlevel 1 call :fail "Khong tim thay npm trong PATH. Can bo cai dat Node.js day du."

for /f "delims=" %%V in ('node -p "process.versions.node"') do set "NODE_VERSION=%%V"
for /f "tokens=1 delims=." %%A in ("%NODE_VERSION%") do set "NODE_MAJOR=%%A"
if %NODE_MAJOR% LSS 22 call :fail "Node.js phai la 22.x tro len. Hien tai: %NODE_VERSION%"

if not exist "node_modules\." (
  echo [INFO] Dang cai dependencies...
  call :run_pnpm install
  if errorlevel 1 call :fail "Cai dependencies that bai."
)

if /I "%CMD%"=="dev" goto dev
if /I "%CMD%"=="dev-classic" goto dev_classic
if /I "%CMD%"=="dev-turbo" goto dev_turbo
if /I "%CMD%"=="start" goto start
if /I "%CMD%"=="build" goto build
if /I "%CMD%"=="check" goto check
if /I "%CMD%"=="clean" goto clean
if /I "%CMD%"=="install" goto install
if /I "%CMD%"=="help" goto help

call :fail "Lenh khong hop le: %CMD%"

:dev
echo [INFO] Dang chay admin-web dev server o che an toan...
call :clean_next_dev_cache
pushd "apps\admin-web" >nul
set "NEXT_TURBO=false"
node --experimental-strip-types --import "./scripts/register-ts-loader.mjs" ./scripts/runtime-supervisor.ts --mode=dev
set "EXITCODE=%ERRORLEVEL%"
popd >nul
if not "%EXITCODE%"=="0" call :pause_on_error
exit /b %EXITCODE%

:dev_classic
echo [INFO] Dang chay admin-web dev server o che classic...
call :clean_next_dev_cache
pushd "apps\admin-web" >nul
set "NEXT_TURBO=false"
node --experimental-strip-types --import "./scripts/register-ts-loader.mjs" ./scripts/runtime-supervisor.ts --mode=dev
set "EXITCODE=%ERRORLEVEL%"
popd >nul
if not "%EXITCODE%"=="0" call :pause_on_error
exit /b %EXITCODE%

:dev_turbo
echo [INFO] Dang chay admin-web dev server voi Turbopack...
call :clean_next_dev_cache
pushd "apps\admin-web" >nul
node --experimental-strip-types --import "./scripts/register-ts-loader.mjs" ./scripts/runtime-supervisor.ts --mode=dev
set "EXITCODE=%ERRORLEVEL%"
popd >nul
if not "%EXITCODE%"=="0" call :pause_on_error
exit /b %EXITCODE%

:start
echo [INFO] Dang chay production start cho admin-web...
pushd "apps\admin-web" >nul
node --experimental-strip-types --import "./scripts/register-ts-loader.mjs" ./scripts/runtime-supervisor.ts --mode=start
set "EXITCODE=%ERRORLEVEL%"
popd >nul
if not "%EXITCODE%"=="0" call :pause_on_error
exit /b %EXITCODE%

:build
echo [INFO] Dang build toan bo du an...
pushd "apps\admin-web" >nul
call "%ROOT%node_modules\.bin\next.CMD" build
set "EXITCODE=%ERRORLEVEL%"
popd >nul
if not "%EXITCODE%"=="0" call :pause_on_error
if not "%EXITCODE%"=="0" exit /b %EXITCODE%

pushd "packages\zalo-bot-js" >nul
call "%ROOT%node_modules\.bin\tsc.CMD" -p tsconfig.json
set "EXITCODE=%ERRORLEVEL%"
popd >nul
if not "%EXITCODE%"=="0" call :pause_on_error
exit /b %EXITCODE%

:check
echo [INFO] Dang chay release gate...
pushd "apps\admin-web" >nul
call "%ROOT%node_modules\.bin\eslint.CMD" .
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" goto check_done_admin
call "%ROOT%node_modules\.bin\tsc.CMD" --noEmit
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" goto check_done_admin
node .\scripts\vitest-runner.mjs run
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" goto check_done_admin
call "%ROOT%node_modules\.bin\next.CMD" build
set "EXITCODE=%ERRORLEVEL%"
:check_done_admin
popd >nul
if not "%EXITCODE%"=="0" call :pause_on_error
if not "%EXITCODE%"=="0" exit /b %EXITCODE%

pushd "packages\zalo-bot-js" >nul
call "%ROOT%node_modules\.bin\tsc.CMD" -p tsconfig.json
set "EXITCODE=%ERRORLEVEL%"
popd >nul
if not "%EXITCODE%"=="0" call :pause_on_error
exit /b %EXITCODE%

:install
echo [INFO] Dang cai dependencies...
call :run_pnpm install
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" call :pause_on_error
exit /b %EXITCODE%

:clean
echo [INFO] Dang xoa cache build...
if exist "apps\admin-web\.next" rd /s /q "apps\admin-web\.next"
if exist ".turbo" rd /s /q ".turbo"
echo [SUCCESS] Da don dep cache.
exit /b 0

:clean_next_dev_cache
if exist "apps\admin-web\.next\dev" rd /s /q "apps\admin-web\.next\dev"
exit /b 0

:help
echo.
echo ManagerOrder launcher
echo.
echo Usage:
echo   %~nx0 [dev^|dev-classic^|dev-turbo^|start^|build^|check^|clean^|install^|help]
echo.
echo Default:
echo   dev
echo.
echo Commands:
echo   dev          - Chay admin-web dev server o che classic an toan
echo   dev-classic  - Chay dev server voi Turbopack tat
echo   dev-turbo    - Chay dev server voi Turbopack
echo   start        - Chay production start cua admin-web
echo   build        - Build full monorepo
echo   check        - Chay lint + typecheck + test + build
echo   clean        - Xoa cache .next va .turbo
echo   install      - Cai dependencies
echo   help         - Hien thi tro giup nay
echo.
exit /b 0

:fail
echo [ERROR] %~1
call :pause_on_error
exit /b 1

:pause_on_error
echo.
echo Nhan phim bat ky de dong cua so nay...
pause >nul
exit /b 0

:run_pnpm
call npm exec --yes pnpm@9.15.9 -- %*
exit /b %ERRORLEVEL%

:fatal
echo [ERROR] Khong the vao thu muc root.
call :pause_on_error
exit /b 1
