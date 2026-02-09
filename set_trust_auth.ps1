
# PostgreSQL Set Trust Authentication Script
# Run this script as Administrator

$ErrorActionPreference = "Stop"

# Check for Administrator privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "❌ ERROR: You are NOT running as Administrator." -ForegroundColor Red
    Write-Host "Please right-click this script and select 'Run with PowerShell', then accept the Admin prompt." -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit 1
}

$serviceName = "postgresql-x64-18"
$pgPath = "C:\Program Files\PostgreSQL\18"
$dataDir = "$pgPath\data"
$hbaFile = "$dataDir\pg_hba.conf"
$backupFile = "$dataDir\pg_hba.conf.bak"

Write-Host "✅ Running as Administrator." -ForegroundColor Green

# Verify Service Exists
if (-not (Get-Service -Name $serviceName -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERROR: Service '$serviceName' not found." -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}

Write-Host "Stopping PostgreSQL service..."
Stop-Service -Name $serviceName -Force

if (-not (Test-Path $backupFile)) {
    Write-Host "Backing up pg_hba.conf..."
    Copy-Item -Path $hbaFile -Destination $backupFile -Force
}

Write-Host "Modifying pg_hba.conf to allow trust authentication ('trust')..."
$content = Get-Content $hbaFile
# change all local/host connections to trust
$newContent = $content -replace "scram-sha-256", "trust" -replace "md5", "trust"
$newContent | Set-Content $hbaFile

Write-Host "Starting PostgreSQL service..."
Start-Service -Name $serviceName

Write-Host "Done! PostgreSQL is now in 'trust' mode (no password required)." -ForegroundColor Cyan
Read-Host "Press Enter to exit..."
