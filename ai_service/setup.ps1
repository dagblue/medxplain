# MedXplain AI Service - Start
# Run: powershell -ExecutionPolicy Bypass -File setup.ps1

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host "   MedXplain AI Service" -ForegroundColor Cyan
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host ""

# Verify deps
$checks = @("fastapi", "uvicorn", "torch", "transformers")
foreach ($pkg in $checks) {
    $result = python -c "import $pkg; print('ok')" 2>&1
    if ($result -match "ok") {
        Write-Host "[OK] $pkg" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] $pkg - run: pip install $pkg" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "[START] http://localhost:8000  (Ctrl+C to stop)" -ForegroundColor Cyan
Write-Host ""

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
