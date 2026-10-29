@echo off
title LIRA FastAPI Backend
cd /d "%~dp0backend"
echo Starting LIRA FastAPI Backend on http://localhost:8000 ...
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause

