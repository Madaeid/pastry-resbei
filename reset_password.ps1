# PostgreSQL Password Reset Script - Interactive Version
# Run this script as Administrator

$ErrorActionPreference = "Stop"

# Check for Administrator privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: You are NOT running as Administrator." -ForegroundColor Red
    Write-Host "Please right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit 1
}

$serviceName = "postgresql-x64-18"
$pgPath = "C:\Program Files\PostgreSQL\18"
$dataDir = "$pgPath\data"
$binDir = "$pgPath\bin"
$hbaFile = "$dataDir\pg_hba.conf"
$backupFile = "$dataDir\pg_hba.conf.bak"

Write-Host "Running as Administrator." -ForegroundColor Green
Write-Host ""

# Step 1: Stop PostgreSQL
Write-Host "Step 1: Stopping PostgreSQL service..." -ForegroundColor Cyan
try {
    Stop-Service -Name $serviceName -Force -ErrorAction Stop
    Start-Sleep -Seconds 2
    Write-Host "PostgreSQL service stopped." -ForegroundColor Green
}
catch {
    Write-Host "Warning: Could not stop service. Continuing..." -ForegroundColor Yellow
}

# Step 2: Backup pg_hba.conf
Write-Host ""
Write-Host "Step 2: Backing up pg_hba.conf..." -ForegroundColor Cyan
if (Test-Path $hbaFile) {
    Copy-Item -Path $hbaFile -Destination $backupFile -Force
    Write-Host "Backup created at $backupFile" -ForegroundColor Green
}
else {
    Write-Host "ERROR: pg_hba.conf not found at $hbaFile" -ForegroundColor Red
    exit 1
}

# Step 3: Modify pg_hba.conf to trust local connections
Write-Host ""
Write-Host "Step 3: Setting trust authentication for local connections..." -ForegroundColor Cyan
$content = Get-Content $hbaFile -Raw
# Replace any authentication method with 'trust' for localhost
$newContent = $content -replace "(host\s+all\s+all\s+127\.0\.0\.1/32\s+)\S+", "`$1trust"
$newContent = $newContent -replace "(host\s+all\s+all\s+::1/128\s+)\S+", "`$1trust"
$newContent | Set-Content $hbaFile -NoNewline
Write-Host "pg_hba.conf modified for trust authentication." -ForegroundColor Green

# Step 4: Start PostgreSQL
Write-Host ""
Write-Host "Step 4: Starting PostgreSQL service..." -ForegroundColor Cyan
try {
    Start-Service -Name $serviceName -ErrorAction Stop
    Start-Sleep -Seconds 3
    Write-Host "PostgreSQL service started." -ForegroundColor Green
}
catch {
    Write-Host "ERROR: Could not start PostgreSQL service." -ForegroundColor Red
    # Restore backup
    Copy-Item -Path $backupFile -Destination $hbaFile -Force
    exit 1
}

# Step 5: Reset password
Write-Host ""
Write-Host "Step 5: Resetting password to 'admin123'..." -ForegroundColor Cyan
try {
    & "$binDir\psql.exe" -U postgres -h 127.0.0.1 -c "ALTER USER postgres WITH PASSWORD 'admin123';"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Password reset successfully!" -ForegroundColor Green
    }
    else {
        Write-Host "Password reset may have failed. Exit code: $LASTEXITCODE" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "Error running psql: $_" -ForegroundColor Red
}

# Step 6: Restore original pg_hba.conf
Write-Host ""
Write-Host "Step 6: Restoring original pg_hba.conf..." -ForegroundColor Cyan
Copy-Item -Path $backupFile -Destination $hbaFile -Force
Write-Host "pg_hba.conf restored." -ForegroundColor Green

# Step 7: Restart PostgreSQL
Write-Host ""
Write-Host "Step 7: Restarting PostgreSQL service..." -ForegroundColor Cyan
Restart-Service -Name $serviceName
Start-Sleep -Seconds 2
Write-Host "PostgreSQL service restarted." -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Password reset complete!" -ForegroundColor Green
Write-Host "New password: admin123" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit..."
