# Aetheris Emergency Mesh - 1-Click Presentation Launch Script
param(
    [string]$Mode = ""
)

$NodeBin = "C:\Users\Parth\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
if (Test-Path $NodeBin) {
    $env:PATH = "$NodeBin;$env:PATH"
}

$NodeExe = Join-Path $NodeBin "node.exe"
if (-not (Test-Path $NodeExe)) { $NodeExe = "node" }

# Dynamically get active IPv4 address (filtering out virtual adapters)
$LocalIP = "127.0.0.1"
if (Test-Path "scripts\get_ip.js") {
    $LocalIP = (& $NodeExe scripts\get_ip.js).Trim()
}

Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "STARTING AETHERIS EMERGENCY MESH SYSTEM FOR PRESENTATION" -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "Detected Active LAN IP: $LocalIP" -ForegroundColor Green

# Determine launch mode if not explicitly passed
if ($Mode -eq "") {
    Write-Host ""
    Write-Host "Select Network Presentation Mode:" -ForegroundColor Yellow
    Write-Host "  [1] LAN / Mobile Hotspot Mode (Laptop and Phones on SAME Wi-Fi or Hotspot)" -ForegroundColor White
    Write-Host "  [2] Global Public Tunnel Mode (Phones on Cellular 5G/4G or DIFFERENT networks)" -ForegroundColor White
    
    $choice = Read-Host "Enter choice (1 or 2, default [1])"
    if ($choice -eq "2") {
        $Mode = "Tunnel"
    } else {
        $Mode = "LAN"
    }
}

$IsTunnelMode = ($Mode -eq "Tunnel" -or $Mode -eq "tunnel")

if ($IsTunnelMode) {
    Write-Host ""
    Write-Host "Mode Selected: GLOBAL PUBLIC TUNNEL MODE (Cross-Network Access)" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Mode Selected: LAN / MOBILE HOTSPOT MODE (Same Wi-Fi Access)" -ForegroundColor Green
}

# Stop any lingering background node or python server processes to release file locks
Get-Process node, python -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

# 1. Start FastAPI Backend (Port 8000)
Write-Host ""
Write-Host "[1/4] Starting FastAPI Routing Intelligence Engine (Port 8000)..." -ForegroundColor Yellow
Start-Process -FilePath "python" -ArgumentList @("-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000") -WindowStyle Hidden

# 2. Start Next.js Web Command Operations Center (Port 3000 bound to 0.0.0.0)
Write-Host "[2/4] Starting Next.js Web Command Center and Mobile Web (Port 3000)..." -ForegroundColor Yellow
$RunNextScript = Join-Path (Get-Location) "scripts\run_next.ps1"
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", $RunNextScript -WindowStyle Hidden







# 3. Start Expo Go Metro Server (Port 8081)
$MobileWebUrl = "http://${LocalIP}:3000/mobile"
$ExpoUrl = "exp://${LocalIP}:8081"

if ($IsTunnelMode) {
    Write-Host "[3/4] Starting Expo Go Metro Server with Public Tunnel..." -ForegroundColor Yellow
    $ExpoBin = Join-Path (Get-Location) "node_modules\expo\bin\cli"
    Start-Process -FilePath $NodeExe -ArgumentList @($ExpoBin, "start", "--clear", "--tunnel") -WindowStyle Hidden
    
    Write-Host "      Starting public web tunnel for Mobile Web App (Port 3000)..." -ForegroundColor Yellow
    if (Test-Path "scripts\tunnel_url.txt") {
        Remove-Item -Force "scripts\tunnel_url.txt" -ErrorAction SilentlyContinue
    }
    $GetTunnelScript = Join-Path (Get-Location) "scripts\get_tunnel.js"
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& '$NodeExe' '$GetTunnelScript'" -WindowStyle Hidden
    
    for ($i = 0; $i -lt 10; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Path "scripts\tunnel_url.txt") {
            $tunnelText = (Get-Content "scripts\tunnel_url.txt" -Raw).Trim()
            if ($tunnelText -match "https://[a-zA-Z0-9-]+\.(trycloudflare\.com|serveousercontent\.com|serveo\.net|loca\.lt|ngrok-free\.app)") {
                $tunnelDomain = $Matches[0]
                $MobileWebUrl = "${tunnelDomain}/mobile"
                Write-Host "      Public Web Tunnel Active: $MobileWebUrl" -ForegroundColor Cyan
                break
            }
        }
    }


} else {
    Write-Host "[3/4] Starting Expo Go Metro Server (Port 8081)..." -ForegroundColor Yellow
    $ExpoBin = Join-Path (Get-Location) "node_modules\expo\bin\cli"
    Start-Process -FilePath $NodeExe -ArgumentList @($ExpoBin, "start", "--clear", "--host", "lan") -WindowStyle Hidden
}

# 4. Generate QR Code PNG Images and Terminal Codes
Write-Host "[4/4] Generating Scannable Presentation QR Codes..." -ForegroundColor Yellow
$env:MOBILE_WEB_URL = $MobileWebUrl
$env:EXPO_URL = $ExpoUrl

if (Test-Path "scripts\download_qr.js") {
    & $NodeExe scripts\download_qr.js "$MobileWebUrl" "$ExpoUrl"
}

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Green
Write-Host "AETHERIS SYSTEM OPERATIONAL AND READY FOR DEMO!" -ForegroundColor Green
Write-Host "===============================================================" -ForegroundColor Green

Write-Host ""
Write-Host "Web Command Operations Center:" -ForegroundColor White
Write-Host "   Local:        http://localhost:3000" -ForegroundColor Cyan
Write-Host "   LAN Network:  http://${LocalIP}:3000" -ForegroundColor Cyan

Write-Host ""
Write-Host "Mobile Victim and Helper App:" -ForegroundColor White
Write-Host "   Mobile Web:   $MobileWebUrl" -ForegroundColor Magenta
Write-Host "   Expo Go URL:  $ExpoUrl" -ForegroundColor Magenta

Write-Host ""
Write-Host "FastAPI Routing Backend API:" -ForegroundColor White
Write-Host "   Swagger Docs: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "   LAN Docs:     http://${LocalIP}:8000/docs" -ForegroundColor Cyan

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "SCANNABLE MOBILE QR CODES (TERMINAL)" -ForegroundColor Yellow
Write-Host "===============================================================" -ForegroundColor Cyan

if (Test-Path "scripts\generate_qr.js") {
    & $NodeExe scripts\generate_qr.js "$MobileWebUrl" "$ExpoUrl"
}

Write-Host ""
Write-Host "Note: PNG images saved to scripts\mobile_web_qr.png and scripts\expo_go_qr.png" -ForegroundColor Green

if (-not $IsTunnelMode) {
    Write-Host ""
    Write-Host "---------------------------------------------------------------" -ForegroundColor Yellow
    Write-Host "NETWORK TROUBLESHOOTING TIP FOR LIVE PRESENTATION:" -ForegroundColor Yellow
    Write-Host "   If people on DIFFERENT networks (cellular 5G/4G or outside Wi-Fi)" -ForegroundColor White
    Write-Host "   cannot open the app, do one of the following:" -ForegroundColor White
    Write-Host "   1. Connect laptop and audience phones to presenter's Mobile Hotspot." -ForegroundColor Cyan
    Write-Host "   2. Re-run script in Tunnel Mode:" -ForegroundColor Cyan
    Write-Host "      powershell -ExecutionPolicy Bypass -File ./start_presentation.ps1 -Mode Tunnel" -ForegroundColor Cyan
    Write-Host "---------------------------------------------------------------" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Good luck with your presentation!" -ForegroundColor Green
