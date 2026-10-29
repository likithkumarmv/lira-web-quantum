# Run LIRA Standalone Mock Backend
Set-Location -Path $PSScriptRoot
if (Test-Path "..\backend\venv\Scripts\python.exe") {
    & "..\backend\venv\Scripts\python.exe" mock_backend.py $args
} else {
    python mock_backend.py $args
}

