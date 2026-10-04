$NodeBin = "C:\Users\Parth\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
if (Test-Path $NodeBin) {
    $env:PATH = "$NodeBin;$env:PATH"
}
$NodeExe = Join-Path $NodeBin "node.exe"

Set-Location "dashboard"
& $NodeExe node_modules\next\dist\bin\next dev -H 0.0.0.0 -p 3000
