@echo off
setlocal EnableExtensions
title HotelHub - Dung he thong

echo ============================================================
echo    HotelHub - Dung Backend (3001) va Frontend (5173)
echo ============================================================
echo.

call :kill_port 3001 Backend
call :kill_port 5173 Frontend

echo.
echo Da dung xong. MySQL van chay (tat trong Laragon neu can).
echo.
pause
exit /b 0

:kill_port
set "FOUND=0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":%~1 " ^| findstr /I "LISTENING"') do (
  if not "%%p"=="0" (
    taskkill /F /PID %%p >nul 2>nul
    if not errorlevel 1 set "FOUND=1"
  )
)
if "%FOUND%"=="1" (
  echo [OK]  Da dung %~2 ^(cong %~1^)
) else (
  echo [--]  %~2 khong chay ^(cong %~1^)
)
goto :eof
