$NodeBin = "C:\Users\Parth\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
if (Test-Path $NodeBin) {
    $env:PATH = "$NodeBin;$env:PATH"
}
$NodeExe = Join-Path $NodeBin "node.exe"
if (-not (Test-Path $NodeExe)) { $NodeExe = "node" }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DashboardDir = Join-Path (Split-Path -Parent $ScriptDir) "dashboard"

Set-Location $DashboardDir

if (-not (Test-Path ".next")) {
    & $NodeExe node_modules\next\dist\bin\next build
}

& $NodeExe node_modules\next\dist\bin\next start -H 0.0.0.0 -p 3000
