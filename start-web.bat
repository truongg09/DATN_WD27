@echo off
setlocal EnableExtensions
title HotelHub - Khoi dong he thong
cd /d "%~dp0"

echo ============================================================
echo    HotelHub  -  Backend (cong 3001) + Frontend (cong 5173)
echo ============================================================
echo.

REM ============ 1. Kiem tra Node.js ============
where node >nul 2>nul
if errorlevel 1 goto :no_node
for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
echo [OK]  Node.js %NODE_VER%

REM ============ 2. Cai thu vien neu thieu ============
if exist "node_modules\" goto :dep_fe_ok
echo [..]  Frontend chua co node_modules, dang chay npm install (co the mat vai phut)...
call npm install
if errorlevel 1 goto :fail_install
:dep_fe_ok
if exist "backend\node_modules\" goto :dep_be_ok
echo [..]  Backend chua co node_modules, dang chay npm install...
pushd backend
call npm install
if errorlevel 1 goto :fail_install_be
popd
:dep_be_ok
echo [OK]  Thu vien da san sang

REM ============ 3. Kiem tra MySQL ============
call :is_port_open 3306
if "%PORT_OPEN%"=="1" goto :mysql_ok
echo [..]  Chua thay MySQL o cong 3306, dang thu khoi dong Laragon...
if not exist "C:\laragon\laragon.exe" goto :mysql_manual
start "" "C:\laragon\laragon.exe" start
call :wait_port 3306 60
if "%PORT_OPEN%"=="1" goto :mysql_ok
:mysql_manual
echo.
echo [!]   Chua ket noi duoc MySQL o cong 3306.
echo       Hay mo Laragon (hoac XAMPP) va bam "Start All", sau do quay lai day.
echo.
pause
call :wait_port 3306 30
if not "%PORT_OPEN%"=="1" goto :fail_mysql
:mysql_ok
echo [OK]  MySQL dang chay (cong 3306)
echo.

REM ============ 4. Khoi dong Backend ============
call :is_port_open 3001
if "%PORT_OPEN%"=="1" goto :be_already
echo [..]  Dang mo cua so Backend...
start "HotelHub Backend (3001)" /d "%~dp0backend" cmd /k npm start
call :wait_port 3001 90
if not "%PORT_OPEN%"=="1" goto :fail_backend
goto :be_check
:be_already
echo [OK]  Backend da chay san o cong 3001
:be_check
powershell -NoProfile -Command "try{$r=Invoke-RestMethod -Uri 'http://localhost:3001/api/db-test' -TimeoutSec 8; if($r.status -eq 'ok'){exit 0}else{exit 1}}catch{exit 1}"
if errorlevel 1 goto :fail_db
echo [OK]  Backend san sang + ket noi CSDL thanh cong
echo.

REM ============ 5. Khoi dong Frontend ============
call :is_port_open 5173
if "%PORT_OPEN%"=="1" goto :fe_already
echo [..]  Dang mo cua so Frontend (Vite)...
start "HotelHub Frontend (5173)" /d "%~dp0." cmd /k npm run dev
call :wait_port 5173 90
if not "%PORT_OPEN%"=="1" goto :fail_frontend
goto :fe_ok
:fe_already
echo [OK]  Frontend da chay san o cong 5173
:fe_ok
echo [OK]  Frontend san sang
echo.

REM ============ 6. Mo trinh duyet ============
echo [..]  Dang mo trinh duyet...
start "" http://localhost:5173
echo.
echo ============================================================
echo    HE THONG DA CHAY
echo      - Giao dien khach:  http://localhost:5173
echo      - API backend:      http://localhost:3001/api
echo.
echo    Hai cua so den (Backend / Frontend) la log cua he thong.
echo    Muon tat: chay file stop-web.bat hoac dong hai cua so do.
echo ============================================================
echo.
pause
exit /b 0

REM ================= CAC HAM PHU =================
:is_port_open
set "PORT_OPEN=0"
netstat -ano | findstr /C:":%~1 " | findstr /I "LISTENING" >nul 2>nul
if not errorlevel 1 set "PORT_OPEN=1"
goto :eof

:wait_port
set "PORT_OPEN=0"
set /a _tries=0
:wp_loop
set /a _tries+=1
netstat -ano | findstr /C:":%~1 " | findstr /I "LISTENING" >nul 2>nul
if not errorlevel 1 goto :wp_found
if %_tries% geq %~2 goto :eof
ping -n 2 127.0.0.1 >nul 2>nul
goto :wp_loop
:wp_found
set "PORT_OPEN=1"
goto :eof

REM ================= CAC LOI =================
:no_node
echo [LOI] Khong tim thay Node.js.
echo       Tai va cai dat tai https://nodejs.org (ban LTS) roi chay lai file nay.
echo.
pause
exit /b 1

:fail_install_be
popd
:fail_install
echo.
echo [LOI] npm install that bai. Kiem tra ket noi mang roi thu lai.
echo.
pause
exit /b 1

:fail_mysql
echo.
echo [LOI] Van chua ket noi duoc MySQL o cong 3306. He thong khong the chay.
echo.
pause
exit /b 1

:fail_backend
echo.
echo [LOI] Backend khong khoi dong duoc trong 90 giay.
echo       Xem thong bao loi trong cua so "HotelHub Backend (3001)".
echo.
pause
exit /b 1

:fail_db
echo.
echo [LOI] Backend chay nhung khong ket noi duoc co so du lieu.
echo       Kiem tra MySQL va thong tin trong file backend\.env (DB_NAME, DB_USER, DB_PASSWORD).
echo.
pause
exit /b 1

:fail_frontend
echo.
echo [LOI] Frontend khong khoi dong duoc trong 90 giay.
echo       Xem thong bao loi trong cua so "HotelHub Frontend (5173)".
echo.
pause
exit /b 1
