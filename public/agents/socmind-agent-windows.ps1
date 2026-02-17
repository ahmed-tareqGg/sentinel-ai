# SOCMind Windows Agent v3.0.0 - Universal Executor
# Copyright (c) 2025 SOCMind. All rights reserved.
# Contact: security@socmind.ai
# Capabilities: Log Collector + Action Executor + IOC Enforcer + Playbook Runner

param([Parameter(Position=0)][string]$Command="help")

# Force TLS 1.2 (required by SOCMind API endpoints)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$script:AgentVersion = "3.0.0"
$script:ConfigPath = Join-Path $PSScriptRoot "agent.conf"
$script:CachePath = Join-Path $PSScriptRoot ".socm_license_cache"
$script:IOCPath = Join-Path $PSScriptRoot ".socm_active_iocs"
$script:ActionLogPath = Join-Path $PSScriptRoot "action_log.json"

# ========== Configuration ==========
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
    param($ApiKey, $ApiEndpoint, $LicenseKey, $Mode)
    @"
[agent]
api_key = $ApiKey
api_endpoint = $ApiEndpoint
license_key = $LicenseKey
mode = $($Mode -or "executor")
"@ | Set-Content $script:ConfigPath -Encoding UTF8
    Write-Host "[OK] Configuration saved to agent.conf" -ForegroundColor Green
}

# ========== License Validation ==========
function Get-HardwareId {
    $node = $env:COMPUTERNAME
    try { $uuid = (Get-WmiObject Win32_ComputerSystemProduct).UUID } catch { $uuid = "unknown" }
    $host_ = [System.Net.Dns]::GetHostName()
    $raw = "$node-$uuid-$host_"
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $hash = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($raw))
    return ([System.BitConverter]::ToString($hash) -replace '-','').Substring(0,32).ToLower()
}

function Test-LicenseFormat {
    param([string]$Key)
    if (-not $Key.StartsWith("SOCM-") -or $Key.Length -ne 24) { return $false }
    $parts = $Key -split '-'
    if ($parts.Count -ne 5) { return $false }
    foreach ($p in $parts[1..4]) {
        if ($p.Length -ne 4 -or $p -notmatch '^[A-Za-z0-9]+$') { return $false }
    }
    return $true
}

function Invoke-LicenseValidation {
    param($ApiEndpoint, $ApiKey, $LicenseKey)
    if (-not (Test-LicenseFormat $LicenseKey)) {
        Write-Host "[ERR:0x4C494E56] Invalid license format" -ForegroundColor Red
        return $false
    }
    $hwid = Get-HardwareId
    $url = "$ApiEndpoint/agent-gateway/validate-license"
    $payload = @{
        license_key = $LicenseKey; hardware_id = $hwid
        agent_version = $script:AgentVersion; platform = "windows"
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
    } | ConvertTo-Json -Compress
    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($payload))
    $body = @{ payload = $encoded } | ConvertTo-Json
    try {
        $headers = @{ "Content-Type" = "application/json"; "X-Agent-Key" = $ApiKey; "User-Agent" = "SOCMind-Agent-Windows/$($script:AgentVersion)" }
        $resp = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -TimeoutSec 30
        if ($resp.is_valid -eq $true) {
            Write-Host "[LICENSE:VALID] Type: $($resp.license_type) | Org: $($resp.organization_name) | Days left: $($resp.days_remaining)" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[LICENSE:INVALID] $($resp.error_message)" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "[ERR:0x4E455457] Network error: $_" -ForegroundColor Yellow
        return $false
    }
}

# ========== Log Collection ==========
$script:LastSecurityTime = $null
$script:LastSystemTime = $null

function Get-SecurityLogs {
    param([int]$MaxEvents = 100)
    $logs = @()
    try {
        $filter = @{ LogName = 'Security'; Id = @(4624, 4625, 4648, 4672, 4688, 4689, 4697, 4698, 4720, 4722, 4724, 4728, 4732) }
        if ($script:LastSecurityTime) { $filter['StartTime'] = $script:LastSecurityTime.AddMilliseconds(1) }
        $securityLogs = Get-WinEvent -FilterHashtable $filter -MaxEvents $MaxEvents -ErrorAction SilentlyContinue
        if ($securityLogs -and $securityLogs.Count -gt 0) {
            $script:LastSecurityTime = ($securityLogs | Sort-Object TimeCreated -Descending | Select-Object -First 1).TimeCreated
        }
        foreach ($evt in $securityLogs) {
            $msgLen = if ($evt.Message) { [Math]::Min(500, $evt.Message.Length) } else { 0 }
            $msg = if ($evt.Message -and $msgLen -gt 0) { $evt.Message.Substring(0, $msgLen) } else { "Event $($evt.Id)" }
            $logs += @{
                log_type = "security"; timestamp = $evt.TimeCreated.ToUniversalTime().ToString("o")
                message = $msg
                severity = if ($evt.Id -in @(4625, 4648)) { 4 } elseif ($evt.Id -in @(4672, 4697)) { 3 } else { 2 }
                event_id = $evt.Id.ToString(); source_ip = $env:COMPUTERNAME
                raw_log = @{ Id = $evt.Id; Provider = $evt.ProviderName }
            }
        }
    } catch {
        if ($_.Exception.Message -notlike "*No events were found*") {
            Write-Host "[WARN] Could not read Security log: $_" -ForegroundColor Yellow
        }
    }
    try {
        $sysFilter = @{ LogName = 'System'; Level = @(1, 2, 3) }
        if ($script:LastSystemTime) { $sysFilter['StartTime'] = $script:LastSystemTime.AddMilliseconds(1) }
        $systemLogs = Get-WinEvent -FilterHashtable $sysFilter -MaxEvents 50 -ErrorAction SilentlyContinue
        if ($systemLogs -and $systemLogs.Count -gt 0) {
            $script:LastSystemTime = ($systemLogs | Sort-Object TimeCreated -Descending | Select-Object -First 1).TimeCreated
        }
        foreach ($evt in $systemLogs) {
            $msgLen = if ($evt.Message) { [Math]::Min(500, $evt.Message.Length) } else { 0 }
            $msg = if ($evt.Message -and $msgLen -gt 0) { $evt.Message.Substring(0, $msgLen) } else { "Event $($evt.Id)" }
            $logs += @{
                log_type = "system"; timestamp = $evt.TimeCreated.ToUniversalTime().ToString("o")
                message = $msg
                severity = if ($evt.Level -eq 1) { 5 } elseif ($evt.Level -eq 2) { 4 } else { 3 }
                event_id = $evt.Id.ToString(); source_ip = $env:COMPUTERNAME
                raw_log = @{ Id = $evt.Id; Provider = $evt.ProviderName; Level = $evt.Level }
            }
        }
    } catch {
        if ($_.Exception.Message -notlike "*No events were found*") {
            Write-Host "[WARN] Could not read System log: $_" -ForegroundColor Yellow
        }
    }
    return $logs
}

function Send-Logs {
    param($ApiEndpoint, $ApiKey, $Logs)
    if ($Logs.Count -eq 0) { Write-Host "[INFO] No new logs (waiting for new events...)" -ForegroundColor Gray; return $true }
    $url = "$ApiEndpoint/agent-gateway/ingest"
    $body = @{ logs = $Logs } | ConvertTo-Json -Depth 10 -Compress
    try {
        $headers = @{ "Content-Type" = "application/json"; "X-Agent-Key" = $ApiKey; "User-Agent" = "SOCMind-Agent-Windows/$($script:AgentVersion)" }
        $resp = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -TimeoutSec 60
        Write-Host "[OK] Sent $($Logs.Count) logs -> $($resp.processed) processed, $($resp.incidents_created) incidents" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "[ERR] Failed to send logs: $_" -ForegroundColor Red
        return $false
    }
}

# ========== ACTION EXECUTION ENGINE ==========
function Write-ActionLog {
    param($ActionId, $ActionType, $Target, $Status, $Details)
    $entry = @{
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        action_id = $ActionId; action_type = $ActionType
        target = $Target; status = $Status; details = $Details
        hostname = $env:COMPUTERNAME
    }
    $existing = @()
    if (Test-Path $script:ActionLogPath) {
        try { $existing = Get-Content $script:ActionLogPath | ConvertFrom-Json } catch { $existing = @() }
    }
    $existing += $entry
    $existing | ConvertTo-Json -Depth 5 | Set-Content $script:ActionLogPath -Encoding UTF8
}

function Invoke-SOARAction {
    param($Action, $DryRun = $false)

    $actionType = $Action.action_type
    $target = $Action.target
    $mode = $Action.execution_mode
    $duration = $Action.duration_seconds
    $actionId = $Action.action_id

    $isDry = $DryRun -or ($mode -eq "dry_run") -or ($mode -eq "simulation")

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "  SOAR ACTION: $actionType" -ForegroundColor Magenta
    Write-Host "  Target: $target" -ForegroundColor Magenta
    Write-Host "  Mode: $(if ($isDry) { 'SIMULATION' } else { 'REAL' })" -ForegroundColor $(if ($isDry) { "Yellow" } else { "Red" })
    Write-Host "========================================" -ForegroundColor Magenta

    $result = @{ success = $false; details = "" }

    try {
        switch ($actionType) {
            "block_ip" {
                if ($isDry) {
                    Write-Host "[DRY-RUN] Would block IP: $target" -ForegroundColor Yellow
                    $result = @{ success = $true; details = "DRY-RUN: Would create firewall rule to block $target" }
                } else {
                    $ruleName = "SOCMind-Block-$target-$(Get-Date -Format 'yyyyMMddHHmmss')"
                    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -RemoteAddress $target -Action Block -ErrorAction Stop | Out-Null
                    New-NetFirewallRule -DisplayName "$ruleName-Out" -Direction Outbound -RemoteAddress $target -Action Block -ErrorAction Stop | Out-Null
                    Write-Host "[OK] Blocked IP: $target (Rule: $ruleName)" -ForegroundColor Green
                    $result = @{ success = $true; details = "Firewall rules created: $ruleName"; rollback_cmd = "Remove-NetFirewallRule -DisplayName '$ruleName'; Remove-NetFirewallRule -DisplayName '$ruleName-Out'" }
                }
            }
            "unblock_ip" {
                if ($isDry) {
                    $result = @{ success = $true; details = "DRY-RUN: Would remove firewall block for $target" }
                } else {
                    Get-NetFirewallRule -DisplayName "SOCMind-Block-$target*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
                    $result = @{ success = $true; details = "Removed firewall block for $target" }
                }
            }
            "kill_process" {
                if ($isDry) {
                    $result = @{ success = $true; details = "DRY-RUN: Would kill process: $target" }
                } else {
                    $procs = Get-Process -Name $target -ErrorAction SilentlyContinue
                    if ($procs) {
                        $procs | Stop-Process -Force
                        $result = @{ success = $true; details = "Killed $($procs.Count) processes named $target" }
                    } else {
                        $result = @{ success = $true; details = "No process found with name: $target" }
                    }
                }
            }
            "disable_user" {
                if ($isDry) {
                    $result = @{ success = $true; details = "DRY-RUN: Would disable user: $target" }
                } else {
                    net user $target /active:no 2>&1 | Out-Null
                    $result = @{ success = $true; details = "User $target disabled"; rollback_available = $true }
                    if ($duration -and $duration -gt 0) {
                        Write-Host "[INFO] User will be re-enabled after $duration seconds" -ForegroundColor Cyan
                        Start-Job -ScriptBlock {
                            param($u, $d)
                            Start-Sleep -Seconds $d
                            net user $u /active:yes
                        } -ArgumentList $target, $duration | Out-Null
                    }
                }
            }
            "enable_user" {
                if ($isDry) {
                    $result = @{ success = $true; details = "DRY-RUN: Would enable user: $target" }
                } else {
                    net user $target /active:yes 2>&1 | Out-Null
                    $result = @{ success = $true; details = "User $target re-enabled" }
                }
            }
            "lock_account" {
                if ($isDry) {
                    $result = @{ success = $true; details = "DRY-RUN: Would lock account: $target" }
                } else {
                    net user $target /active:no 2>&1 | Out-Null
                    $result = @{ success = $true; details = "Account $target locked"; rollback_available = $true }
                    if ($duration -and $duration -gt 0) {
                        Start-Job -ScriptBlock {
                            param($u, $d); Start-Sleep -Seconds $d; net user $u /active:yes
                        } -ArgumentList $target, $duration | Out-Null
                    }
                }
            }
            "reset_password" {
                if ($isDry) {
                    $result = @{ success = $true; details = "DRY-RUN: Would force password reset for: $target" }
                } else {
                    $tempPw = "SOCMind_Reset_$(Get-Random -Minimum 10000 -Maximum 99999)!"
                    net user $target $tempPw /logonpasswordchg:yes 2>&1 | Out-Null
                    $result = @{ success = $true; details = "Password reset forced for $target. User must change at next logon." }
                }
            }
            "stop_service" {
                if ($isDry) {
                    $result = @{ success = $true; details = "DRY-RUN: Would stop service: $target" }
                } else {
                    Stop-Service -Name $target -Force -ErrorAction Stop
                    $result = @{ success = $true; details = "Service $target stopped"; rollback_available = $true }
                }
            }
            "start_service" {
                if ($isDry) {
                    $result = @{ success = $true; details = "DRY-RUN: Would start service: $target" }
                } else {
                    Start-Service -Name $target -ErrorAction Stop
                    $result = @{ success = $true; details = "Service $target started" }
                }
            }
            "quarantine_file" {
                if ($isDry) {
                    $result = @{ success = $true; details = "DRY-RUN: Would quarantine file: $target" }
                } else {
                    $quarantineDir = "C:\SOCMind\Quarantine"
                    if (-not (Test-Path $quarantineDir)) { New-Item -ItemType Directory -Path $quarantineDir -Force | Out-Null }
                    if (Test-Path $target) {
                        $fileName = [System.IO.Path]::GetFileName($target)
                        $qPath = Join-Path $quarantineDir "$fileName.quarantined"
                        Move-Item -Path $target -Destination $qPath -Force
                        $result = @{ success = $true; details = "File quarantined: $target -> $qPath"; rollback_available = $true }
                    } else {
                        $result = @{ success = $false; details = "File not found: $target" }
                    }
                }
            }
            "delete_file" {
                if ($isDry) {
                    $result = @{ success = $true; details = "DRY-RUN: Would delete file: $target" }
                } else {
                    if (Test-Path $target) {
                        Remove-Item -Path $target -Force
                        $result = @{ success = $true; details = "File deleted: $target" }
                    } else {
                        $result = @{ success = $false; details = "File not found: $target" }
                    }
                }
            }
            "isolate_host" {
                if ($isDry) {
                    $result = @{ success = $true; details = "DRY-RUN: Would isolate host (block all non-SOCMind traffic)" }
                } else {
                    # Block all outbound except SOCMind gateway
                    $gwHost = $Action.parameters.gateway_host
                    New-NetFirewallRule -DisplayName "SOCMind-Isolate-BlockAll" -Direction Outbound -Action Block -ErrorAction SilentlyContinue | Out-Null
                    if ($gwHost) {
                        New-NetFirewallRule -DisplayName "SOCMind-Isolate-AllowGW" -Direction Outbound -RemoteAddress $gwHost -Action Allow -ErrorAction SilentlyContinue | Out-Null
                    }
                    $result = @{ success = $true; details = "Host isolated. Only SOCMind gateway traffic allowed."; rollback_available = $true }
                }
            }
            "unisolate_host" {
                if ($isDry) {
                    $result = @{ success = $true; details = "DRY-RUN: Would remove host isolation" }
                } else {
                    Get-NetFirewallRule -DisplayName "SOCMind-Isolate-*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
                    $result = @{ success = $true; details = "Host isolation removed" }
                }
            }
            "show_warning" {
                $msg = $Action.parameters.message -or "SOCMind Security Alert: Suspicious activity detected on this workstation."
                if (-not $isDry) {
                    msg * "$msg" 2>&1 | Out-Null
                }
                $result = @{ success = $true; details = "Warning banner displayed to user" }
            }
            default {
                $result = @{ success = $false; details = "Unknown action type: $actionType" }
            }
        }
    } catch {
        $result = @{ success = $false; details = "Action failed: $_" }
        Write-Host "[ERR] Action failed: $_" -ForegroundColor Red
    }

    Write-ActionLog -ActionId $actionId -ActionType $actionType -Target $target -Status $(if ($result.success) {"completed"} else {"failed"}) -Details $result.details
    return $result
}

function Send-ActionResult {
    param($ApiEndpoint, $ApiKey, $ActionDbId, $Result)
    try {
        $url = "$ApiEndpoint/agent-gateway/report-action"
        $body = @{
            action_id = $ActionDbId
            status = if ($Result.success) { "success" } else { "failed" }
            result = $Result
            error_message = if (-not $Result.success) { $Result.details } else { $null }
            rollback_available = [bool]$Result.rollback_available
        } | ConvertTo-Json -Depth 5
        $headers = @{ "Content-Type" = "application/json"; "X-Agent-Key" = $ApiKey }
        Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -TimeoutSec 30 | Out-Null
        Write-Host "[OK] Action result reported to platform" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Could not report action result: $_" -ForegroundColor Yellow
    }
}

function Poll-Actions {
    param($ApiEndpoint, $ApiKey)
    try {
        $url = "$ApiEndpoint/agent-gateway/poll-actions"
        $headers = @{ "Content-Type" = "application/json"; "X-Agent-Key" = $ApiKey }
        $resp = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body "{}" -TimeoutSec 15
        return $resp.actions
    } catch {
        return @()
    }
}

# ========== IOC Enforcement ==========
function Enforce-IOCs {
    param($ApiEndpoint, $ApiKey)
    # IOC enforcement is handled via SOAR actions (block_ip, etc.)
    # This polls for IOC-specific actions dispatched by the platform
}

# ========== Commands ==========
function Invoke-Configure {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  SOCMind Windows Agent v$($script:AgentVersion) - Configuration" -ForegroundColor Cyan
    Write-Host "  Mode: Universal Executor" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    $existing = Read-Config
    $apiEndpoint = Read-Host "API Endpoint"
    if ([string]::IsNullOrWhiteSpace($apiEndpoint) -and $existing) { $apiEndpoint = $existing["api_endpoint"] }
    $apiKey = Read-Host "API Key (socm_...)"
    if ([string]::IsNullOrWhiteSpace($apiKey) -and $existing) { $apiKey = $existing["api_key"] }
    $licenseKey = Read-Host "License Key (SOCM-XXXX-XXXX-XXXX-XXXX)"
    if ([string]::IsNullOrWhiteSpace($licenseKey) -and $existing) { $licenseKey = $existing["license_key"] }
    if ([string]::IsNullOrWhiteSpace($apiEndpoint) -or [string]::IsNullOrWhiteSpace($apiKey) -or [string]::IsNullOrWhiteSpace($licenseKey)) {
        Write-Host "[FATAL] All fields are required!" -ForegroundColor Red; return
    }
    Write-Config -ApiKey $apiKey -ApiEndpoint $apiEndpoint -LicenseKey $licenseKey -Mode "executor"
    Write-Host "[INFO] Validating license..." -ForegroundColor Cyan
    $valid = Invoke-LicenseValidation -ApiEndpoint $apiEndpoint -ApiKey $apiKey -LicenseKey $licenseKey
    if ($valid) { Write-Host "[OK] Ready! Run './socmind-agent-windows.ps1 run' to start." -ForegroundColor Green }
}

function Invoke-Run {
    param([switch]$DryRun)
    $cfg = Read-Config
    if (-not $cfg -or -not $cfg["api_key"] -or -not $cfg["api_endpoint"]) {
        Write-Host "[FATAL] Not configured. Run './socmind-agent-windows.ps1 configure' first." -ForegroundColor Red; return
    }
    $apiKey = $cfg["api_key"]; $apiEndpoint = $cfg["api_endpoint"]; $licenseKey = $cfg["license_key"]
    if ([string]::IsNullOrWhiteSpace($licenseKey)) {
        $licenseKey = Read-Host "Enter license key (SOCM-XXXX-XXXX-XXXX-XXXX)"
        if ([string]::IsNullOrWhiteSpace($licenseKey)) { Write-Host "[FATAL] License key required!" -ForegroundColor Red; return }
    }

    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  SOCMind Windows Agent v$($script:AgentVersion)" -ForegroundColor Cyan
    Write-Host "  Capabilities: Collector + Executor + IOC" -ForegroundColor Cyan
    Write-Host "  Mode: $(if ($DryRun) { 'DRY-RUN (Simulation)' } else { 'LIVE' })" -ForegroundColor $(if ($DryRun) { "Yellow" } else { "Green" })
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "[INFO] Validating license..." -ForegroundColor Cyan
    if (-not (Invoke-LicenseValidation -ApiEndpoint $apiEndpoint -ApiKey $apiKey -LicenseKey $licenseKey)) {
        Write-Host "[FATAL] License validation failed." -ForegroundColor Red; return
    }

    Write-Host "[INFO] Starting agent (Ctrl+C to stop)..." -ForegroundColor Cyan
    $interval = 60; $actionPollInterval = 10; $lastActionPoll = [DateTime]::MinValue
    $lastValidation = Get-Date; $validationInterval = 3600

    while ($true) {
        try {
            # Re-validate license hourly
            if (((Get-Date) - $lastValidation).TotalSeconds -ge $validationInterval) {
                if (-not (Invoke-LicenseValidation -ApiEndpoint $apiEndpoint -ApiKey $apiKey -LicenseKey $licenseKey)) {
                    Write-Host "[FATAL] License expired." -ForegroundColor Red; break
                }
                $lastValidation = Get-Date
            }

            # Collect and send logs
            $logs = Get-SecurityLogs -MaxEvents 50
            Send-Logs -ApiEndpoint $apiEndpoint -ApiKey $apiKey -Logs $logs | Out-Null

            # Poll for SOAR actions (every 10 seconds)
            if (((Get-Date) - $lastActionPoll).TotalSeconds -ge $actionPollInterval) {
                $actions = Poll-Actions -ApiEndpoint $apiEndpoint -ApiKey $apiKey
                if ($actions -and $actions.Count -gt 0) {
                    Write-Host "[ACTION] Received $($actions.Count) action(s) from platform" -ForegroundColor Magenta
                    foreach ($act in $actions) {
                        $result = Invoke-SOARAction -Action $act -DryRun:$DryRun
                        Send-ActionResult -ApiEndpoint $apiEndpoint -ApiKey $apiKey -ActionDbId $act.id -Result $result
                    }
                }
                $lastActionPoll = Get-Date
            }

            # Heartbeat
            try {
                $heartbeatUrl = "$apiEndpoint/agent-gateway/heartbeat"
                $heartbeatBody = @{
                    hostname = $env:COMPUTERNAME; status = "active"; logs_sent = $logs.Count
                    ip_address = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -First 1).IPAddress
                    agent_version = $script:AgentVersion; capabilities = @("collector", "executor", "ioc_enforcer")
                } | ConvertTo-Json
                Invoke-RestMethod -Uri $heartbeatUrl -Method Post -Headers @{ "X-Agent-Key" = $apiKey; "Content-Type" = "application/json" } -Body $heartbeatBody -TimeoutSec 10 | Out-Null
            } catch { }

            Start-Sleep -Seconds $interval
        } catch {
            Write-Host "[ERR] Error: $_" -ForegroundColor Red
            Start-Sleep -Seconds 10
        }
    }
}

function Show-Status {
    $cfg = Read-Config
    Write-Host ""
    Write-Host "SOCMind Agent v$($script:AgentVersion) Status" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    if (-not $cfg) {
        Write-Host "Status: NOT CONFIGURED" -ForegroundColor Red
    } else {
        Write-Host "API Endpoint: $($cfg["api_endpoint"])" -ForegroundColor Gray
        Write-Host "API Key: $($cfg["api_key"].Substring(0,12))..." -ForegroundColor Gray
        $lic = $cfg["license_key"]
        if ($lic) { Write-Host "License: $($lic.Substring(0,9))..." -ForegroundColor Gray }
        Write-Host "Hardware ID: $(Get-HardwareId)" -ForegroundColor Gray
        Write-Host "Capabilities: Collector, Executor, IOC Enforcer" -ForegroundColor Green
    }
    if (Test-Path $script:ActionLogPath) {
        try {
            $actionLog = Get-Content $script:ActionLogPath | ConvertFrom-Json
            Write-Host "`nRecent Actions: $($actionLog.Count)" -ForegroundColor Cyan
            $actionLog | Select-Object -Last 5 | ForEach-Object {
                Write-Host "  [$($_.timestamp)] $($_.action_type) -> $($_.target) = $($_.status)" -ForegroundColor Gray
            }
        } catch {}
    }
    Write-Host ""
}

function Show-Help {
    Write-Host ""
    Write-Host "SOCMind Windows Agent v$($script:AgentVersion) - Universal Executor" -ForegroundColor Cyan
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor White
    Write-Host "  configure    - Set up API credentials and license" -ForegroundColor Gray
    Write-Host "  run          - Start agent (collect logs + execute actions)" -ForegroundColor Gray
    Write-Host "  run --dry-run - Start in simulation mode (no real actions)" -ForegroundColor Gray
    Write-Host "  status       - Check agent status and recent actions" -ForegroundColor Gray
    Write-Host "  help         - Show this message" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Supported Actions:" -ForegroundColor White
    Write-Host "  block_ip, unblock_ip, kill_process, disable_user, enable_user" -ForegroundColor Gray
    Write-Host "  lock_account, reset_password, stop_service, start_service" -ForegroundColor Gray
    Write-Host "  quarantine_file, delete_file, isolate_host, unisolate_host" -ForegroundColor Gray
    Write-Host "  show_warning" -ForegroundColor Gray
    Write-Host ""
}

# ========== Main ==========
switch ($Command.ToLower()) {
    "configure" { Invoke-Configure }
    "run"       {
        $isDryRun = $args -contains "--dry-run"
        Invoke-Run -DryRun:$isDryRun
    }
    "start"     { Invoke-Run }
    "status"    { Show-Status }
    "help"      { Show-Help }
    default     { Show-Help }
}
