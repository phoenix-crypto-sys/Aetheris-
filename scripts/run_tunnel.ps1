$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutFile = Join-Path $ScriptDir "tunnel_out.log"
$ErrFile = Join-Path $ScriptDir "tunnel_err.log"
$UrlFile = Join-Path $ScriptDir "tunnel_url.txt"

if (Test-Path $OutFile) { Remove-Item -Force $OutFile }
if (Test-Path $ErrFile) { Remove-Item -Force $ErrFile }
if (Test-Path $UrlFile) { Remove-Item -Force $UrlFile }

# Launch Serveo SSH Tunnel for port 3000
Start-Process -FilePath "ssh" -ArgumentList "-o", "StrictHostKeyChecking=no", "-R", "80:localhost:3000", "serveo.net" -RedirectStandardOutput $OutFile -RedirectStandardError $ErrFile -WindowStyle Hidden
