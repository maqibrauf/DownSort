# Stops and removes the DownSort scheduled task.
#   .\scripts\unregister-task.ps1

Stop-ScheduledTask -TaskName "DownSort" -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "DownSort" -Confirm:$false
Write-Host "DownSort scheduled task removed."
