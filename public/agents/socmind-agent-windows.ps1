# SOCMind Agent for Windows
# Lightweight log collection and forwarding agent
# Run as Administrator

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

$AgentVersion = "1.0.0"
$ConfigPath = "$env:ProgramData\SOCMind\agent.conf"
$LogPath = "$env:ProgramData\SOCMind\agent.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    # Console output with colors
    switch ($Level) {
        "ERROR" { Write-Host "[SOCMind ERROR] $Message" -ForegroundColor Red }
        "WARN"  { Write-Host "[SOCMind WARN] $Message" -ForegroundColor Yellow }
        default { Write-Host "[SOCMind] $Message" -ForegroundColor Green }
    }
    
    # File output
    if (Test-Path (Split-Path $LogPath -Parent)) {
        Add-Content -Path $LogPath -Value $logMessage
    }
}

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-Config {
    if (Test-Path $ConfigPath) {
        $config = @{}
        Get-Content $ConfigPath | ForEach-Object {
            if ($_ -match "^(.+?)=(.+)$") {
                $config[$matches[1].Trim()] = $matches[2].Trim().Trim('"')
            }
        }
        return $config
    }
    return $null
}

function Set-AgentConfig {
    Write-Log "Configuring SOCMind Agent..."
    
    # Create directory
    $configDir = Split-Path $ConfigPath -Parent
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
    
    $defaultEndpoint = "https://kglmzurhiiuhxmzykkqv.supabase.co/functions/v1/agent-gateway"
    
    $endpoint = Read-Host "Enter SOCMind API Endpoint [$defaultEndpoint]"
    if ([string]::IsNullOrWhiteSpace($endpoint)) { $endpoint = $defaultEndpoint }
    
    $apiKey = Read-Host "Enter Agent API Key"
    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        Write-Log "API Key is required" -Level "ERROR"
        return
    }
    
    $logTypes = Read-Host "Enter Log Types to collect (comma-separated) [Security,System,Application]"
    if ([string]::IsNullOrWhiteSpace($logTypes)) { $logTypes = "Security,System,Application" }
    
    $interval = Read-Host "Enter collection interval in seconds [60]"
    if ([string]::IsNullOrWhiteSpace($interval)) { $interval = "60" }
    
    $hostname = $env:COMPUTERNAME
    
    $configContent = @"
SOCMIND_API_ENDPOINT="$endpoint"
SOCMIND_API_KEY="$apiKey"
SOCMIND_LOG_TYPES="$logTypes"
SOCMIND_INTERVAL="$interval"
SOCMIND_HOSTNAME="$hostname"
"@
    
    Set-Content -Path $ConfigPath -Value $configContent
    Write-Log "Configuration saved to $ConfigPath"
}

function Send-Heartbeat {
    param(
        [string]$Status = "active",
        [string]$ErrorMessage = ""
    )
    
    $config = Get-Config
    if (-not $config) { return }
    
    $body = @{
        hostname = $config["SOCMIND_HOSTNAME"]
        status = $Status
    }
    
    if ($ErrorMessage) {
        $body["error_message"] = $ErrorMessage
    }
    
    try {
        $headers = @{
            "X-Agent-Key" = $config["SOCMIND_API_KEY"]
            "Content-Type" = "application/json"
        }
        
        Invoke-RestMethod -Uri "$($config["SOCMIND_API_ENDPOINT"])/heartbeat" `
            -Method Post -Headers $headers -Body ($body | ConvertTo-Json) -ErrorAction SilentlyContinue
    }
    catch {
        # Silently fail heartbeat
    }
}

function Get-SecurityLogs {
    param([int]$MaxEvents = 50)
    
    $logs = @()
    $config = Get-Config
    
    try {
        $events = Get-WinEvent -LogName Security -MaxEvents $MaxEvents -ErrorAction SilentlyContinue
        
        foreach ($event in $events) {
            $severity = 2
            $eventType = "Security Event"
            
            switch ($event.Id) {
                4624 { $eventType = "Successful Logon"; $severity = 2 }
                4625 { $eventType = "Failed Logon"; $severity = 4 }
                4648 { $eventType = "Explicit Credential Logon"; $severity = 3 }
                4672 { $eventType = "Special Privileges Assigned"; $severity = 3 }
                4688 { $eventType = "Process Created"; $severity = 2 }
                4697 { $eventType = "Service Installed"; $severity = 3 }
                4720 { $eventType = "User Account Created"; $severity = 3 }
                4726 { $eventType = "User Account Deleted"; $severity = 3 }
                4728 { $eventType = "Member Added to Security Group"; $severity = 3 }
                4732 { $eventType = "Member Added to Local Group"; $severity = 3 }
                4738 { $eventType = "User Account Changed"; $severity = 3 }
                4771 { $eventType = "Kerberos Pre-Auth Failed"; $severity = 4 }
                4776 { $eventType = "NTLM Authentication"; $severity = 3 }
                5140 { $eventType = "Network Share Access"; $severity = 2 }
                5156 { $eventType = "Windows Filtering Platform Connection"; $severity = 2 }
            }
            
            $logs += @{
                log_type = "security"
                timestamp = $event.TimeCreated.ToString("o")
                message = "$eventType - Event ID: $($event.Id) - $($event.Message -replace '\r?\n', ' ' | Select-Object -First 200)"
                severity = $severity
                source_ip = $config["SOCMIND_HOSTNAME"]
                event_id = $event.Id.ToString()
                raw_log = @{
                    source = "Windows Security Log"
                    provider = $event.ProviderName
                    event_id = $event.Id
                }
            }
        }
    }
    catch {
        Write-Log "Error collecting Security logs: $_" -Level "WARN"
    }
    
    return $logs
}

function Get-SystemLogs {
    param([int]$MaxEvents = 30)
    
    $logs = @()
    $config = Get-Config
    
    try {
        $events = Get-WinEvent -LogName System -MaxEvents $MaxEvents -ErrorAction SilentlyContinue
        
        foreach ($event in $events) {
            $severity = switch ($event.Level) {
                1 { 5 } # Critical
                2 { 4 } # Error
                3 { 3 } # Warning
                4 { 2 } # Information
                default { 2 }
            }
            
            $eventType = switch ($event.Level) {
                1 { "Critical System Event" }
                2 { "System Error" }
                3 { "System Warning" }
                default { "System Event" }
            }
            
            $logs += @{
                log_type = "system"
                timestamp = $event.TimeCreated.ToString("o")
                message = "$eventType - $($event.ProviderName): $($event.Message -replace '\r?\n', ' ' | Select-Object -First 200)"
                severity = $severity
                source_ip = $config["SOCMIND_HOSTNAME"]
                raw_log = @{
                    source = "Windows System Log"
                    provider = $event.ProviderName
                    event_id = $event.Id
                }
            }
        }
    }
    catch {
        Write-Log "Error collecting System logs: $_" -Level "WARN"
    }
    
    return $logs
}

function Get-ApplicationLogs {
    param([int]$MaxEvents = 20)
    
    $logs = @()
    $config = Get-Config
    
    try {
        $events = Get-WinEvent -LogName Application -MaxEvents $MaxEvents -ErrorAction SilentlyContinue
        
        foreach ($event in $events) {
            $severity = switch ($event.Level) {
                1 { 5 }
                2 { 4 }
                3 { 3 }
                default { 2 }
            }
            
            $logs += @{
                log_type = "application"
                timestamp = $event.TimeCreated.ToString("o")
                message = "$($event.ProviderName): $($event.Message -replace '\r?\n', ' ' | Select-Object -First 200)"
                severity = $severity
                source_ip = $config["SOCMIND_HOSTNAME"]
                raw_log = @{
                    source = "Windows Application Log"
                    provider = $event.ProviderName
                    event_id = $event.Id
                }
            }
        }
    }
    catch {
        Write-Log "Error collecting Application logs: $_" -Level "WARN"
    }
    
    return $logs
}

function Send-Logs {
    param([array]$Logs)
    
    if ($Logs.Count -eq 0) { return $true }
    
    $config = Get-Config
    if (-not $config) { return $false }
    
    $body = @{
        logs = $Logs
    }
    
    try {
        $headers = @{
            "X-Agent-Key" = $config["SOCMIND_API_KEY"]
            "Content-Type" = "application/json"
        }
        
        $response = Invoke-RestMethod -Uri "$($config["SOCMIND_API_ENDPOINT"])/ingest" `
            -Method Post -Headers $headers -Body ($body | ConvertTo-Json -Depth 10)
        
        Write-Log "Successfully sent $($Logs.Count) logs"
        return $true
    }
    catch {
        Write-Log "Failed to send logs: $_" -Level "ERROR"
        return $false
    }
}

function Start-Agent {
    if (-not (Test-Administrator)) {
        Write-Log "This script must be run as Administrator" -Level "ERROR"
        return
    }
    
    $config = Get-Config
    if (-not $config) {
        Write-Log "Configuration not found. Run 'socmind-agent.ps1 configure' first" -Level "ERROR"
        return
    }
    
    Write-Log "SOCMind Agent v$AgentVersion starting..."
    Write-Log "Hostname: $($config["SOCMIND_HOSTNAME"])"
    Write-Log "API Endpoint: $($config["SOCMIND_API_ENDPOINT"])"
    Write-Log "Log Types: $($config["SOCMIND_LOG_TYPES"])"
    Write-Log "Interval: $($config["SOCMIND_INTERVAL"])s"
    
    # Initial heartbeat
    Send-Heartbeat -Status "active"
    
    $interval = [int]$config["SOCMIND_INTERVAL"]
    $logTypes = $config["SOCMIND_LOG_TYPES"] -split ","
    
    while ($true) {
        $allLogs = @()
        
        foreach ($logType in $logTypes) {
            $logType = $logType.Trim()
            
            switch ($logType.ToLower()) {
                "security" { $allLogs += Get-SecurityLogs }
                "system" { $allLogs += Get-SystemLogs }
                "application" { $allLogs += Get-ApplicationLogs }
                default { Write-Log "Unknown log type: $logType" -Level "WARN" }
            }
        }
        
        if ($allLogs.Count -gt 0) {
            $success = Send-Logs -Logs $allLogs
            if (-not $success) {
                Send-Heartbeat -Status "error" -ErrorMessage "Failed to send logs"
            }
        }
        
        Send-Heartbeat -Status "active"
        
        Start-Sleep -Seconds $interval
    }
}

function Install-AsService {
    if (-not (Test-Administrator)) {
        Write-Log "This script must be run as Administrator" -Level "ERROR"
        return
    }
    
    $scriptPath = $MyInvocation.MyCommand.Path
    
    # Create scheduled task that runs at startup
    $action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
        -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`" run"
    
    $trigger = New-ScheduledTaskTrigger -AtStartup
    
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" `
        -LogonType ServiceAccount -RunLevel Highest
    
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1)
    
    Register-ScheduledTask -TaskName "SOCMind Agent" -Action $action `
        -Trigger $trigger -Principal $principal -Settings $settings -Force
    
    Write-Log "Installed as scheduled task. Starting now..."
    Start-ScheduledTask -TaskName "SOCMind Agent"
}

function Show-Help {
    Write-Host ""
    Write-Host "SOCMind Agent v$AgentVersion for Windows" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\socmind-agent.ps1 <command>"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  configure    Configure the agent with API credentials"
    Write-Host "  run          Start the agent in foreground"
    Write-Host "  install      Install as Windows scheduled task"
    Write-Host "  help         Show this help message"
    Write-Host ""
    Write-Host "Example:"
    Write-Host "  .\socmind-agent.ps1 configure"
    Write-Host "  .\socmind-agent.ps1 run"
    Write-Host ""
}

# Main entry point
switch ($Command.ToLower()) {
    "configure" { Set-AgentConfig }
    "run" { Start-Agent }
    "install" { Install-AsService }
    "help" { Show-Help }
    default { 
        Write-Log "Unknown command: $Command" -Level "ERROR"
        Show-Help
    }
}