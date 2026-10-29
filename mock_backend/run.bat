@echo off
title LIRA Mock Backend
cd /d "%~dp0"
if exist "..\backend\venv\Scripts\python.exe" (
    "..\backend\venv\Scripts\python.exe" mock_backend.py %*
) else (
    python mock_backend.py %*
)
pause
