# Quick PostgreSQL Password Reset
# Run this in an Administrator PowerShell window

Write-Host "Stopping PostgreSQL..." -ForegroundColor Yellow
Stop-Service postgresql-x64-18 -Force
Start-Sleep -Seconds 2

# Modify pg_hba.conf to trust
$hbaPath = "C:\Program Files\PostgreSQL\18\data\pg_hba.conf"
$content = Get-Content $hbaPath -Raw
$content = $content -replace "(host\s+all\s+all\s+127\.0\.0\.1/32\s+)\S+", "`$1trust"
$content | Set-Content $hbaPath -NoNewline

Write-Host "Starting PostgreSQL with trust..." -ForegroundColor Yellow
Start-Service postgresql-x64-18
Start-Sleep -Seconds 3

Write-Host "Resetting password..." -ForegroundColor Yellow
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h 127.0.0.1 -c "ALTER USER postgres WITH PASSWORD 'admin123';"

# Restore secure authentication
$content = Get-Content $hbaPath -Raw
$content = $content -replace "(host\s+all\s+all\s+127\.0\.0\.1/32\s+)\S+", "`$1scram-sha-256"
$content | Set-Content $hbaPath -NoNewline

Write-Host "Restarting PostgreSQL..." -ForegroundColor Yellow
Restart-Service postgresql-x64-18
Start-Sleep -Seconds 2

Write-Host "Done! Password is now: admin123" -ForegroundColor Green
