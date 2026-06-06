# Run backend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\disaster-response\disaster-response\backend'; mvn spring-boot:run"

# Wait 15 seconds for backend to start, then run frontend
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\disaster-response\disaster-response\frontend'; npm run dev"

Write-Host "Starting app..."
Write-Host "Backend:  http://localhost:8080"
Write-Host "Frontend: http://localhost:5173"
Write-Host ""
Write-Host "Demo logins:"
Write-Host "  Admin:     admin@disaster.com / admin123"
Write-Host "  Volunteer: volunteer@disaster.com / vol123"
Write-Host "  Citizen:   citizen@disaster.com / cit123"
