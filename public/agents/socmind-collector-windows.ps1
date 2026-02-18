# SOCMind Collector Agent v1.0.0 - Log Collector Only
# Copyright (c) 2025 SOCMind. All rights reserved.
# Contact: security@socmind.ai
#
# PURPOSE: Lightweight log collector — NO execution capabilities.
# Collects Windows Event Logs and ships them to the SOCMind platform.
# Deploy this on every endpoint. Requires no admin rights for reading logs.
#
# Usage:
#   .\socmind-collector-windows.ps1 configure   — First time setup
#   .\socmind-collector-windows.ps1 start       — Start collecting
#   .\socmind-collector-windows.ps1 status      — Show current status
#   .\socmind-collector-windows.ps1 test        — Send 1 test batch

param([Parameter(Position=0)][string]$Command="help")

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$script:AgentVersion = "1.0.0"
$script:AgentRole    = "collector"
$script:ConfigPath   = Join-Path $PSScriptRoot "collector.conf"

# ========== Config ==========
function Read-Config {
    if (-not (Test-Path $script:ConfigPath)) { return $null }
    $cfg = @{}
    Get-Content $script:ConfigPath | ForEach-Object {
        if ($_ -match '^\s*([^#=]+?)\s*=\s*(.+?)\s*$') {
            $cfg[$Matches[1].Trim()] = $Matches[2].Trim()
        }
    }
    return $cfg
}

function Write-Config {
    param($ApiKey, $ApiEndpoint)
    @"
[collector]
api_key      = $ApiKey
api_endpoint = $ApiEndpoint
role         = collector
"@ | Set-Content $script:ConfigPath -Encoding UTF8
    Write-Host "[OK] collector.conf saved" -ForegroundColor Green
}

# ========== Log Collection ==========
$script:LastSecurityTime  = $null
$script:LastSystemTime    = $null
$script:LastFirewallTime  = $null
$script:LastAppTime       = $null
$script:LastPSTime        = $null
$script:TotalLogsSent     = 0
$script:EmptyRounds       = 0

function Get-WindowsLogs {
    param([int]$MaxEvents = 100)
    $logs = @()

    # --- Security ---
    try {
        $f = @{ LogName = 'Security'; Id = @(4624,4625,4648,4672,4688,4689,4697,4720,4728,4732,5156,5157) }
        if ($script:LastSecurityTime) { $f['StartTime'] = $script:LastSecurityTime.AddSeconds(1) }
        $events = @(Get-WinEvent -FilterHashtable $f -MaxEvents $MaxEvents -ErrorAction Stop)
        foreach ($e in $events) {
            $logs += @{
                log_type   = "security"
                timestamp  = $e.TimeCreated.ToUniversalTime().ToString("o")
                message    = $e.Message
                severity   = if ($e.LevelDisplayName -eq "Error") {5} elseif ($e.LevelDisplayName -eq "Warning") {3} else {2}
                event_id   = $e.Id.ToString()
                source_ip  = $env:COMPUTERNAME
                event_type = "windows_security"
                raw_log    = @{ EventId = $e.Id; Provider = $e.ProviderName; Level = $e.LevelDisplayName }
            }
        }
        if ($events.Count -gt 0) { $script:LastSecurityTime = $events[0].TimeCreated }
    } catch {}

    # --- System ---
    try {
        $f = @{ LogName = 'System'; Level = @(1,2,3) }
        if ($script:LastSystemTime) { $f['StartTime'] = $script:LastSystemTime.AddSeconds(1) }
        $events = @(Get-WinEvent -FilterHashtable $f -MaxEvents 50 -ErrorAction Stop)
        foreach ($e in $events) {
            $logs += @{
                log_type   = "system"
                timestamp  = $e.TimeCreated.ToUniversalTime().ToString("o")
                message    = $e.Message
                severity   = if ($e.Level -le 2) {4} else {2}
                event_id   = $e.Id.ToString()
                source_ip  = $env:COMPUTERNAME
                event_type = "windows_system"
                raw_log    = @{ EventId = $e.Id; Provider = $e.ProviderName }
            }
        }
        if ($events.Count -gt 0) { $script:LastSystemTime = $events[0].TimeCreated }
    } catch {}

    # --- PowerShell Script Block (4103, 4104) ---
    try {
        $f = @{ LogName = 'Microsoft-Windows-PowerShell/Operational'; Id = @(4103,4104) }
        if ($script:LastPSTime) { $f['StartTime'] = $script:LastPSTime.AddSeconds(1) }
        $events = @(Get-WinEvent -FilterHashtable $f -MaxEvents 30 -ErrorAction Stop)
        foreach ($e in $events) {
            $logs += @{
                log_type   = "powershell"
                timestamp  = $e.TimeCreated.ToUniversalTime().ToString("o")
                message    = $e.Message
                severity   = 3
                event_id   = $e.Id.ToString()
                source_ip  = $env:COMPUTERNAME
                event_type = "powershell_scriptblock"
                raw_log    = @{ EventId = $e.Id }
            }
        }
        if ($events.Count -gt 0) { $script:LastPSTime = $events[0].TimeCreated }
    } catch {}

    # --- Windows Firewall ---
    try {
        $f = @{ LogName = 'Microsoft-Windows-Windows Firewall With Advanced Security/Firewall'; Id = @(2004,2005,2006) }
        if ($script:LastFirewallTime) { $f['StartTime'] = $script:LastFirewallTime.AddSeconds(1) }
        $events = @(Get-WinEvent -FilterHashtable $f -MaxEvents 30 -ErrorAction Stop)
        foreach ($e in $events) {
            $logs += @{
                log_type   = "firewall"
                timestamp  = $e.TimeCreated.ToUniversalTime().ToString("o")
                message    = $e.Message
                severity   = 3
                event_id   = $e.Id.ToString()
                source_ip  = $env:COMPUTERNAME
                event_type = "windows_firewall_policy"
                raw_log    = @{ EventId = $e.Id }
            }
        }
        if ($events.Count -gt 0) { $script:LastFirewallTime = $events[0].TimeCreated }
    } catch {}

    return $logs
}

function Send-Logs {
    param($ApiEndpoint, $ApiKey, $Logs)
    if ($Logs.Count -eq 0) {
        $script:EmptyRounds++
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] No new events (total: $($script:TotalLogsSent))" -ForegroundColor DarkGray
        # Reset trackers after 5 empty rounds to catch delayed events
        if ($script:EmptyRounds -ge 5) {
            $script:LastSecurityTime = (Get-Date).AddMinutes(-2)
            $script:LastSystemTime   = (Get-Date).AddMinutes(-2)
            $script:LastPSTime       = (Get-Date).AddMinutes(-2)
            $script:LastFirewallTime = (Get-Date).AddMinutes(-2)
            $script:EmptyRounds      = 0
        }
        return $true
    }

    $script:EmptyRounds = 0
    $url  = "$ApiEndpoint/agent-gateway/ingest"
    $body = @{ logs = $Logs } | ConvertTo-Json -Depth 10 -Compress
    try {
        $headers = @{
            "Content-Type" = "application/json"
            "X-Agent-Key"  = $ApiKey
            "User-Agent"   = "SOCMind-Collector-Windows/$($script:AgentVersion)"
        }
        $resp = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -TimeoutSec 120
        $script:TotalLogsSent += $Logs.Count
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Sent $($Logs.Count) logs -> $($resp.logs_ingested) ingested (total: $($script:TotalLogsSent))" -ForegroundColor Green
        return $true
    } catch {
        if ($_.Exception.Message -like "*timed out*") {
            Write-Host "[WARN] Timeout - logs likely received. Continuing..." -ForegroundColor Yellow
            return $true
        }
        Write-Host "[ERR] Failed to send logs: $_" -ForegroundColor Red
        return $false
    }
}

function Send-Heartbeat {
    param($ApiEndpoint, $ApiKey)
    try {
        $localIP = $null
        try { $localIP = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -First 1).IPAddress } catch {}
        $body = @{
            hostname      = $env:COMPUTERNAME
            status        = "active"
            logs_sent     = $script:TotalLogsSent
            ip_address    = $localIP
            agent_version = $script:AgentVersion
            capabilities  = @("collector")
        } | ConvertTo-Json
        $headers = @{ "X-Agent-Key" = $ApiKey; "Content-Type" = "application/json" }
        Invoke-RestMethod -Uri "$ApiEndpoint/agent-gateway/heartbeat" -Method Post -Headers $headers -Body $body -TimeoutSec 10 | Out-Null
    } catch {}
}

# ========== Commands ==========
function Invoke-Configure {
    Write-Host ""
    Write-Host "SOCMind Collector Setup" -ForegroundColor Cyan
    Write-Host "=======================" -ForegroundColor Cyan
    Write-Host "Role: LOG COLLECTOR ONLY (no execution capabilities)" -ForegroundColor Yellow
    Write-Host ""
    $apiKey      = Read-Host "API Key"
    $apiEndpoint = Read-Host "API Endpoint (e.g. https://xxxx.supabase.co/functions/v1)"

    # Validate connectivity
    try {
        $testHeaders = @{ "X-Agent-Key" = $apiKey; "Content-Type" = "application/json" }
        Invoke-RestMethod -Uri "$apiEndpoint/agent-gateway/heartbeat" -Method Post -Headers $testHeaders -Body '{"hostname":"setup-test","status":"active"}' -TimeoutSec 15 | Out-Null
        Write-Host "[OK] Connection verified" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response) {
            Write-Host "[OK] Endpoint reachable (auth required)" -ForegroundColor Green
        } else {
            Write-Host "[WARN] Could not verify endpoint: $_" -ForegroundColor Yellow
        }
    }

    Write-Config -ApiKey $apiKey -ApiEndpoint $apiEndpoint
    Write-Host ""
    Write-Host "Setup complete. Run: .\socmind-collector-windows.ps1 start" -ForegroundColor Cyan
}

function Invoke-Start {
    param([switch]$Test)
    $cfg = Read-Config
    if (-not $cfg) { Write-Host "[ERR] Not configured. Run 'configure' first." -ForegroundColor Red; return }

    $apiKey      = $cfg["api_key"]
    $apiEndpoint = $cfg["api_endpoint"]

    $logInterval       = if ($Test) { 10 } else { 30 }
    $heartbeatInterval = 60
    $lastLog           = [DateTime]::MinValue
    $lastHeartbeat     = [DateTime]::MinValue

    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  SOCMind COLLECTOR v$($script:AgentVersion)" -ForegroundColor Cyan
    Write-Host "  Host:     $env:COMPUTERNAME" -ForegroundColor Gray
    Write-Host "  Role:     LOG COLLECTOR ONLY" -ForegroundColor Green
    Write-Host "  Endpoint: $apiEndpoint" -ForegroundColor Gray
    Write-Host "  Interval: ${logInterval}s" -ForegroundColor Gray
    Write-Host "  Press Ctrl+C to stop" -ForegroundColor Gray
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""

    if ($Test) {
        Write-Host "[TEST] Single collection cycle..." -ForegroundColor Yellow
        $logs = Get-WindowsLogs -MaxEvents 50
        Send-Logs -ApiEndpoint $apiEndpoint -ApiKey $apiKey -Logs $logs
        Write-Host "[TEST] Done." -ForegroundColor Green
        return
    }

    while ($true) {
        try {
            $now = Get-Date
            if (($now - $lastLog).TotalSeconds -ge $logInterval) {
                $logs = Get-WindowsLogs -MaxEvents 100
                Send-Logs -ApiEndpoint $apiEndpoint -ApiKey $apiKey -Logs $logs
                $lastLog = $now
            }
            if (($now - $lastHeartbeat).TotalSeconds -ge $heartbeatInterval) {
                Send-Heartbeat -ApiEndpoint $apiEndpoint -ApiKey $apiKey
                $lastHeartbeat = $now
            }
            Start-Sleep -Seconds 5
        } catch {
            Write-Host "[ERR] Loop: $_" -ForegroundColor Red
            Start-Sleep -Seconds 5
        }
    }
}

function Show-Status {
    $cfg = Read-Config
    Write-Host ""
    Write-Host "SOCMind Collector v$($script:AgentVersion)" -ForegroundColor Cyan
    Write-Host "==================================" -ForegroundColor Cyan
    if (-not $cfg) {
        Write-Host "Status: NOT CONFIGURED" -ForegroundColor Red
    } else {
        Write-Host "Endpoint : $($cfg['api_endpoint'])" -ForegroundColor Gray
        Write-Host "API Key  : $($cfg['api_key'].Substring(0,[Math]::Min(12,$cfg['api_key'].Length)))..." -ForegroundColor Gray
        Write-Host "Role     : COLLECTOR ONLY (no execution)" -ForegroundColor Yellow
        Write-Host "Host     : $env:COMPUTERNAME" -ForegroundColor Gray
    }
    Write-Host ""
}

function Show-Help {
    Write-Host ""
    Write-Host "SOCMind Collector Agent v$($script:AgentVersion)" -ForegroundColor Cyan
    Write-Host "Role: LOG COLLECTOR ONLY — no SOAR execution" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor White
    Write-Host "  configure   First-time setup (API key + endpoint)" -ForegroundColor Gray
    Write-Host "  start       Start continuous log collection" -ForegroundColor Gray
    Write-Host "  test        Run one collection cycle and exit" -ForegroundColor Gray
    Write-Host "  status      Show configuration" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Deploy on EVERY endpoint to collect logs." -ForegroundColor Green
    Write-Host "Use socmind-executor.py on ONE secure host for SOAR actions." -ForegroundColor Green
    Write-Host ""
}

# ========== Entry Point ==========
switch ($Command.ToLower()) {
    "configure" { Invoke-Configure }
    "start"     { Invoke-Start }
    "test"      { Invoke-Start -Test }
    "status"    { Show-Status }
    default     { Show-Help }
}
