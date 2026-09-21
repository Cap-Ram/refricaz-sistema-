$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$port = 5600
$node = "C:\Users\USUARIO\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$serverScript = Join-Path $PSScriptRoot "local-server.js"

$isListening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($isListening) {
    Write-Host "Servidor Refricaz ya está activo en http://127.0.0.1:$port"
    exit 0
}

if (-not (Test-Path $node)) {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCommand) {
        throw "No se encontró Node.js para levantar el servidor local."
    }
    $node = $nodeCommand.Source
}

Start-Process -FilePath $node -ArgumentList @($serverScript) -WorkingDirectory $root -WindowStyle Hidden
Start-Sleep -Seconds 1
Write-Host "Servidor Refricaz activo en http://127.0.0.1:$port"
