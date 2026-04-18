# LOQIT Quick Start Script
# This script clears the ports, sets up the USB bridge, and starts the Expo server.

Write-Host "Starting LOQIT Development Environment..." -ForegroundColor Cyan

# 1. Kill any existing node processes on port 8081
Write-Host "Clearing port 8081..." -ForegroundColor Yellow
$portProcess = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
if ($portProcess) {
    Stop-Process -Id $portProcess.OwningProcess -Force -ErrorAction SilentlyContinue
}

# 2. Setup USB Reverse Proxy for stability
Write-Host "Attempting to set up USB Bridge (localhost:8081)..." -ForegroundColor Yellow
$adbOutput = (adb reverse tcp:8081 tcp:8081 2>&1) | Out-String
if ($adbOutput -match "error") {
    Write-Host "No USB device detected. Proceeding with fully WIRELESS mode!" -ForegroundColor Magenta
} else {
    Write-Host "USB connection handled." -ForegroundColor Green
}

# 3. Start Expo (Optimized for Speed)
Write-Host "Starting Metro Bundler..." -ForegroundColor Green
npx expo start
