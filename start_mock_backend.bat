@echo off
title LIRA Standalone Mock Backend
cd /d "%~dp0mock_backend"
echo Starting LIRA Standalone Mock Backend (Contracts C-2 and C-3)...
..\backend\venv\Scripts\python.exe mock_backend.py %*
pause

