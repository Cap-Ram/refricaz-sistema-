$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
& "$PSScriptRoot\start-local-server.ps1"

$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
Start-Process "http://127.0.0.1:5600/index.html"
    exit 0
}

Start-Process -FilePath $edge -ArgumentList "http://127.0.0.1:5600/index.html"
