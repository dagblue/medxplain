# MedXplain — Start all servers
# Usage: .\start.ps1

Write-Host "Starting MedXplain..." -ForegroundColor Cyan

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# AI Service
$aiCmd = "Set-Location '$root\ai_service'; Write-Host 'AI Service on :8000' -ForegroundColor Green; python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
Start-Process powershell -ArgumentList @("-NoExit", "-Command", $aiCmd)

Start-Sleep -Seconds 2

# Next.js
$webCmd = "Set-Location '$root'; Write-Host 'Next.js on :3000' -ForegroundColor Blue; npm run dev"
Start-Process powershell -ArgumentList @("-NoExit", "-Command", $webCmd)

Write-Host "Servers launching:" -ForegroundColor Green
Write-Host "  http://localhost:3000  (frontend)" -ForegroundColor White
Write-Host "  http://localhost:8000  (AI service)" -ForegroundColor White
Write-Host "  http://localhost:8000/docs  (API docs)" -ForegroundColor White
