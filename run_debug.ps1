Write-Host "Starting Electron Git GUI Debug Mode..." -ForegroundColor Green
Write-Host ""

Write-Host "Running build renderer command..." -ForegroundColor Yellow
npm run build-renderer
if ($LASTEXITCODE -ne 0) {
    Write-Host "Renderer build failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Starting dev server..." -ForegroundColor Yellow
npm run dev

Write-Host ""
Write-Host "Press Enter to exit..." -ForegroundColor Gray
Read-Host