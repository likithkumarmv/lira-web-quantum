@echo off
title LIRA Localhost Launcher
echo =======================================================
echo Starting LIRA Logistics Intelligence and Recovery Platform
echo =======================================================
echo.

cd /d "%~dp0"

echo [1/2] Launching LIRA FastAPI Backend on http://localhost:8000 ...
start "LIRA Backend (Port 8000)" cmd /k "cd /d "%~dp0backend" && .\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Launching LIRA Next.js Frontend on http://localhost:3000 ...
start "LIRA Frontend (Port 3000)" cmd /k "cd /d "%~dp0frontend" && npm.cmd run dev"

echo.
echo Waiting 4 seconds for servers to initialize...
timeout /t 4 /nobreak >nul

echo Opening LIRA Dashboard in default browser...
start http://localhost:3000

echo.
echo =======================================================
echo LIRA is running!
echo - Web Dashboard:  http://localhost:3000
echo - API Backend:    http://localhost:8000
echo - Swagger Docs:   http://localhost:8000/docs
echo =======================================================
echo Press any key to exit this launcher window (servers will keep running).
pause >nul

