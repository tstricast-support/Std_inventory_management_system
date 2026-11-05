npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed - not copying" -ForegroundColor Red; exit 1 }
Remove-Item -Recurse -Force ..\backend\frontend_dist -ErrorAction SilentlyContinue
Copy-Item -Recurse dist ..\backend\frontend_dist
Write-Host "frontend_dist updated - now deploy the backend" -ForegroundColor Green