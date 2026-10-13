@echo off
title MedXplain AI Service
echo.
echo  ==========================================
echo   MedXplain AI Service - Starting...
echo  ==========================================
echo.
echo [INFO] Using system Python (all deps pre-installed)
echo [INFO] Service will be available at http://localhost:8000
echo [INFO] Press Ctrl+C to stop
echo.
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
