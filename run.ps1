# Starts backend + frontend in two new PowerShell windows.
# Paths are resolved relative to this script, so the project can live on any drive.

$root     = $PSScriptRoot
$backend  = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

foreach ($dir in @($backend, $frontend)) {
    if (-not (Test-Path $dir)) {
        Write-Error "Missing directory: $dir"
        exit 1
    }
}

Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$backend'; mvn spring-boot:run"

# Give the backend a head start so the Vite proxy has something to talk to
Start-Sleep -Seconds 5

Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$frontend'; npm run dev"

Write-Host ''
Write-Host 'Starting app...'
Write-Host '  Frontend: http://localhost:3000'
Write-Host '  Backend:  http://localhost:8081/api/health'
Write-Host '  H2 console: http://localhost:8081/h2  (JDBC jdbc:h2:mem:disaster, user sa, no password)'
Write-Host ''
Write-Host 'Demo logins:'
Write-Host '  Admin:     admin@disaster.com / admin123'
Write-Host '  Volunteer: volunteer@disaster.com / vol123'
Write-Host '  Citizen:   citizen@disaster.com / cit123'
