# Registers DownSort to start automatically at logon, hidden (no console window).
# Run this once from an elevated or normal PowerShell prompt:
#   .\scripts\register-task.ps1

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbsPath = Join-Path $scriptDir "start-hidden.vbs"

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "DownSort" -Action $action -Trigger $trigger -Settings $settings `
  -Description "Watches Downloads and sorts files via DownSort" -Force

Write-Host "DownSort registered to start at logon. Starting it now..."
Start-ScheduledTask -TaskName "DownSort"
