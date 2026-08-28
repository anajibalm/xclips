# run-web.ps1 — Start Next.js UI (port 3350) and Hono API (port 3351)
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Starting LIVE-ASSIST Web Platform v1  " -ForegroundColor Cyan
Write-Host "  UI  : http://localhost:3350            " -ForegroundColor Green
Write-Host "  API : http://localhost:3351            " -ForegroundColor Green
Write-Host "  Tailscale: http://100.116.104.113:3350  " -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan

# Start API in background job
$apiJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    bun src/server/index.ts
}

# Start Next.js dev server on 3350
try {
    bun run next dev -p 3350
}
finally {
    Stop-Job $apiJob -ErrorAction SilentlyContinue
    Remove-Job $apiJob -ErrorAction SilentlyContinue
    Write-Host "Shutting down servers." -ForegroundColor Gray
}
