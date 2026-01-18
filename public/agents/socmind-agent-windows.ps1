# SOCMind Agent for Windows v1.1
# Lightweight log collection and forwarding agent with remote control
# Run as Administrator

param(
    [Parameter(Position = 0)]
    [string]$Command = "help"
)

$AgentVersion = "1.1.0"
$ConfigPath = "$env:ProgramData\SOCMind\agent.conf"
$LogPath = "$env:ProgramData\SOCMind\agent.log"
$StatePath = "$env:ProgramData\SOCMind\agent.state"

# Agent state
$script:AgentPaused = $false
$script:AgentRunning = $true

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    # Console output with colors
    switch ($Level) {
        "ERROR" { Write-Host "[SOCMind ERROR] $Message" -ForegroundColor Red }
        "WARN" { Write-Host "[SOCMind WARN] $Message" -ForegroundColor Yellow }
        "DEBUG" { Write-Host "[SOCMind DEBUG] $Message" -ForegroundColor Gray }
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

function Get-ConfigValue {
    param(
        [hashtable]$Config,
        [string[]]$Keys
    )

    foreach ($k in $Keys) {
        if ($Config.ContainsKey($k) -and -not [string]::IsNullOrWhiteSpace($Config[$k])) {
            return $Config[$k]
        }
    }

    return $null
}

function Get-LocalIPAddress {
    try {
        # Get first active IPv4 address that isn't localhost
        $ip = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
            $_.InterfaceAlias -notlike "*Loopback*" -and 
            $_.IPAddress -notlike "169.254.*" 
        } | Select-Object -First 1 -ExpandProperty IPAddress
        
        if ($ip) { return $ip }
        return "0.0.0.0"
    }
    catch {
        return "0.0.0.0"
    }
}

function Save-AgentState {
    param([string]$State)
    $stateDir = Split-Path $StatePath -Parent
    if (-not (Test-Path $stateDir)) {
        New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    }
    Set-Content -Path $StatePath -Value $State
}

function Get-AgentState {
    if (Test-Path $StatePath) {
        return Get-Content $StatePath
    }
    return "running"
}

function Set-AgentConfig {
    Write-Log "Configuring SOCMind Agent v$AgentVersion..."
    
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
    $agentId = [guid]::NewGuid().ToString()
    
    $configContent = @"
# SOCMind Agent Configuration v1.1
# (Supports both SOCMIND_* keys and simple keys for compatibility)

# Agent Identity
SOCMIND_AGENT_ID="$agentId"
SOCMIND_HOSTNAME="$hostname"
SOCMIND_AGENT_VERSION="$AgentVersion"

# API Configuration
SOCMIND_API_ENDPOINT="$endpoint"
SOCMIND_API_KEY="$apiKey"

# Collection Settings
SOCMIND_LOG_TYPES="$logTypes"
SOCMIND_INTERVAL="$interval"

# Compatibility keys
endpoint="$endpoint"
api_key="$apiKey"
log_types="$logTypes"
interval="$interval"
hostname="$hostname"
"@
    
    Set-Content -Path $ConfigPath -Value $configContent
    Save-AgentState "running"
    Write-Log "Configuration saved to $ConfigPath"
    Write-Log "Agent ID: $agentId"
}

function Send-Heartbeat {
    param(
        [string]$Status = "active",
        [string]$ErrorMessage = ""
    )
    
    $config = Get-Config
    if (-not $config) { return $null }

    $endpoint = Get-ConfigValue -Config $config -Keys @('SOCMIND_API_ENDPOINT', 'endpoint')
    $apiKey = Get-ConfigValue -Config $config -Keys @('SOCMIND_API_KEY', 'api_key', 'AGENT_API_KEY', 'AGENT_KEY')
    $hostname = Get-ConfigValue -Config $config -Keys @('SOCMIND_HOSTNAME', 'hostname')
    $agentId = Get-ConfigValue -Config $config -Keys @('SOCMIND_AGENT_ID')
    $logTypes = Get-ConfigValue -Config $config -Keys @('SOCMIND_LOG_TYPES', 'log_types')

    if ([string]::IsNullOrWhiteSpace($endpoint) -or [string]::IsNullOrWhiteSpace($apiKey)) {
        return $null
    }

    $ipAddress = Get-LocalIPAddress
    
    # Build heartbeat payload with full agent info
    $body = @{
        agent_id = $agentId
        hostname = $hostname
        ip_address = $ipAddress
        os = "windows"
        status = $Status
        log_types = $logTypes -split ","
    }
    
    if ($ErrorMessage) { 
        $body["error_message"] = $ErrorMessage 
    }

    try {
        $headers = @{ 
            "X-Agent-Key" = $apiKey
            "Content-Type" = "application/json" 
        }

        $response = Invoke-RestMethod -Uri "$endpoint/heartbeat" `
            -Method Post -Headers $headers -Body ($body | ConvertTo-Json) -ErrorAction Stop
        
        # Check for remote commands
        if ($response.command) {
            Write-Log "Received remote command: $($response.command)" -Level "WARN"
            return $response.command
        }
        
        return $null
    }
    catch {
        Write-Log "Heartbeat failed: $_" -Level "DEBUG"
        return $null
    }
}

function Process-RemoteCommand {
    param([string]$Command)
    
    switch ($Command.ToLower()) {
        "pause" {
            Write-Log "Remote command: PAUSE - Stopping log collection" -Level "WARN"
            $script:AgentPaused = $true
            Save-AgentState "paused"
        }
        "resume" {
            Write-Log "Remote command: RESUME - Resuming log collection" -Level "INFO"
            $script:AgentPaused = $false
            Save-AgentState "running"
        }
        "start" {
            Write-Log "Remote command: START - Starting log collection" -Level "INFO"
            $script:AgentPaused = $false
            $script:AgentRunning = $true
            Save-AgentState "running"
        }
        "stop" {
            Write-Log "Remote command: STOP - Stopping agent" -Level "WARN"
            $script:AgentRunning = $false
            Save-AgentState "stopped"
        }
        "terminate" {
            Write-Log "Remote command: TERMINATE - Shutting down agent" -Level "ERROR"
            $script:AgentRunning = $false
            Save-AgentState "terminated"
            exit 0
        }
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
                log_type  = "security"
                timestamp = $event.TimeCreated.ToString("o")
                message   = "$eventType - Event ID: $($event.Id) - $($event.Message -replace '\r?\n', ' ' | ForEach-Object { if ($_.Length -gt 200) { $_.Substring(0, 200) } else { $_ } })"
                severity  = $severity
                source_ip = Get-LocalIPAddress
                event_id  = $event.Id.ToString()
                raw_log   = @{
                    source   = "Windows Security Log"
                    provider = $event.ProviderName
                    event_id = $event.Id
                    hostname = $env:COMPUTERNAME
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
                log_type  = "system"
                timestamp = $event.TimeCreated.ToString("o")
                message   = "$eventType - $($event.ProviderName): $($event.Message -replace '\r?\n', ' ' | ForEach-Object { if ($_.Length -gt 200) { $_.Substring(0, 200) } else { $_ } })"
                severity  = $severity
                source_ip = Get-LocalIPAddress
                event_id  = $event.Id.ToString()
                raw_log   = @{
                    source   = "Windows System Log"
                    provider = $event.ProviderName
                    event_id = $event.Id
                    hostname = $env:COMPUTERNAME
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
                log_type  = "application"
                timestamp = $event.TimeCreated.ToString("o")
                message   = "$($event.ProviderName): $($event.Message -replace '\r?\n', ' ' | ForEach-Object { if ($_.Length -gt 200) { $_.Substring(0, 200) } else { $_ } })"
                severity  = $severity
                source_ip = Get-LocalIPAddress
                event_id  = $event.Id.ToString()
                raw_log   = @{
                    source   = "Windows Application Log"
                    provider = $event.ProviderName
                    event_id = $event.Id
                    hostname = $env:COMPUTERNAME
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

    $endpoint = Get-ConfigValue -Config $config -Keys @('SOCMIND_API_ENDPOINT', 'endpoint')
    $apiKey = Get-ConfigValue -Config $config -Keys @('SOCMIND_API_KEY', 'api_key', 'AGENT_API_KEY', 'AGENT_KEY')

    if ([string]::IsNullOrWhiteSpace($endpoint) -or [string]::IsNullOrWhiteSpace($apiKey)) {
        Write-Log "API Key is required" -Level "ERROR"
        return $false
    }

    $body = @{ logs = $Logs }

    try {
        $headers = @{ 
            "X-Agent-Key" = $apiKey
            "Content-Type" = "application/json" 
        }

        $response = Invoke-RestMethod -Uri "$endpoint/ingest" `
            -Method Post -Headers $headers -Body ($body | ConvertTo-Json -Depth 10)

        Write-Log "Successfully sent $($Logs.Count) logs (Incidents: $($response.incidents.Count), Skipped: $($response.skipped_duplicates))"
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

    $endpoint = Get-ConfigValue -Config $config -Keys @('SOCMIND_API_ENDPOINT', 'endpoint')
    $hostname = Get-ConfigValue -Config $config -Keys @('SOCMIND_HOSTNAME', 'hostname')
    $logTypesRaw = Get-ConfigValue -Config $config -Keys @('SOCMIND_LOG_TYPES', 'log_types')
    $intervalRaw = Get-ConfigValue -Config $config -Keys @('SOCMIND_INTERVAL', 'interval')
    $agentId = Get-ConfigValue -Config $config -Keys @('SOCMIND_AGENT_ID')

    Write-Log "SOCMind Agent v$AgentVersion starting..."
    Write-Log "Agent ID: $agentId"
    Write-Log "Hostname: $hostname"
    Write-Log "IP Address: $(Get-LocalIPAddress)"
    Write-Log "API Endpoint: $endpoint"
    Write-Log "Log Types: $logTypesRaw"
    Write-Log "Interval: $intervalRaw`s"

    # Restore state
    $savedState = Get-AgentState
    if ($savedState -eq "paused") {
        $script:AgentPaused = $true
        Write-Log "Restored paused state" -Level "WARN"
    }

    # Initial heartbeat
    $command = Send-Heartbeat -Status "active"
    if ($command) { Process-RemoteCommand -Command $command }

    $interval = [int]$intervalRaw
    $logTypes = $logTypesRaw -split ","
    
    while ($script:AgentRunning) {
        # Check for remote commands via heartbeat
        $status = if ($script:AgentPaused) { "paused" } else { "active" }
        $command = Send-Heartbeat -Status $status
        if ($command) { 
            Process-RemoteCommand -Command $command 
        }

        # Skip log collection if paused
        if ($script:AgentPaused) {
            Write-Log "Agent paused - skipping log collection" -Level "DEBUG"
            Start-Sleep -Seconds $interval
            continue
        }

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
        
        Start-Sleep -Seconds $interval
    }

    Write-Log "Agent stopped" -Level "WARN"
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

function Show-Status {
    $config = Get-Config
    if (-not $config) {
        Write-Log "Agent not configured" -Level "ERROR"
        return
    }

    $state = Get-AgentState
    $hostname = Get-ConfigValue -Config $config -Keys @('SOCMIND_HOSTNAME', 'hostname')
    $agentId = Get-ConfigValue -Config $config -Keys @('SOCMIND_AGENT_ID')
    $endpoint = Get-ConfigValue -Config $config -Keys @('SOCMIND_API_ENDPOINT', 'endpoint')
    
    Write-Host ""
    Write-Host "SOCMind Agent Status" -ForegroundColor Cyan
    Write-Host "===================="
    Write-Host "Version:    $AgentVersion"
    Write-Host "Agent ID:   $agentId"
    Write-Host "Hostname:   $hostname"
    Write-Host "IP Address: $(Get-LocalIPAddress)"
    Write-Host "State:      $state"
    Write-Host "Endpoint:   $endpoint"
    Write-Host ""
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
    Write-Host "  status       Show agent status"
    Write-Host "  help         Show this help message"
    Write-Host ""
    Write-Host "Remote Control:"
    Write-Host "  The agent supports remote control commands via the SOCMind dashboard:"
    Write-Host "  - Start:     Resume log collection"
    Write-Host "  - Pause:     Stop log collection but keep heartbeat"
    Write-Host "  - Stop:      Stop the agent"
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
    "status" { Show-Status }
    "help" { Show-Help }
    default { 
        Write-Log "Unknown command: $Command" -Level "ERROR"
        Show-Help
    }
}
