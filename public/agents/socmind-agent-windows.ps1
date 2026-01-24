# SOCMind Windows Agent v2.1.0
# Copyright (c) 2025 SOCMind. All rights reserved.
# Contact: security@socmind.ai

param([Parameter(Position=0)][string]$Command="help")

$script:ConfigPath = Join-Path $PSScriptRoot "agent.conf"
$script:CachePath = Join-Path $PSScriptRoot ".socm_license_cache"

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
    param($ApiKey, $ApiEndpoint, $LicenseKey)
    @"
[agent]
api_key = $ApiKey
api_endpoint = $ApiEndpoint
license_key = $LicenseKey
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
        license_key = $LicenseKey
        hardware_id = $hwid
        agent_version = "2.1.0"
        platform = "windows"
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
    } | ConvertTo-Json -Compress
    
    # Base64 encode for transmission
    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($payload))
    $body = @{ payload = $encoded } | ConvertTo-Json
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
            "X-Agent-Key" = $ApiKey
            "User-Agent" = "SOCMind-Agent-Windows/2.1.0"
        }
        $resp = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -TimeoutSec 30
        
        if ($resp.is_valid -eq $true) {
            Write-Host "[LICENSE:VALID] Type: $($resp.license_type) | Org: $($resp.organization_name) | Days left: $($resp.days_remaining)" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[LICENSE:INVALID] $($resp.error_message)" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "[ERR:0x4E455457] Network error during license validation: $_" -ForegroundColor Yellow
        # Could check cache here for offline mode
        return $false
    }
}

# ========== Log Collection ==========
function Get-SecurityLogs {
    param([int]$MaxEvents = 100)
    $logs = @()
    
    # Security Event Log
    try {
        $securityLogs = Get-WinEvent -LogName Security -MaxEvents $MaxEvents -ErrorAction SilentlyContinue | 
            Where-Object { $_.Id -in @(4624, 4625, 4648, 4672, 4688, 4689, 4697, 4698, 4720, 4722, 4724, 4728, 4732) }
        foreach ($evt in $securityLogs) {
            $logs += @{
                log_type = "security"
                timestamp = $evt.TimeCreated.ToUniversalTime().ToString("o")
                message = $evt.Message.Substring(0, [Math]::Min(500, $evt.Message.Length))
                severity = if ($evt.Id -in @(4625, 4648)) { 4 } elseif ($evt.Id -in @(4672, 4697)) { 3 } else { 2 }
                event_id = $evt.Id.ToString()
                source_ip = $env:COMPUTERNAME
                raw_log = @{ Id = $evt.Id; Provider = $evt.ProviderName }
            }
        }
    } catch { Write-Host "[WARN] Could not read Security log: $_" -ForegroundColor Yellow }
    
    # System Event Log
    try {
        $systemLogs = Get-WinEvent -LogName System -MaxEvents 50 -ErrorAction SilentlyContinue |
            Where-Object { $_.Level -le 3 }
        foreach ($evt in $systemLogs) {
            $logs += @{
                log_type = "system"
                timestamp = $evt.TimeCreated.ToUniversalTime().ToString("o")
                message = $evt.Message.Substring(0, [Math]::Min(500, $evt.Message.Length))
                severity = if ($evt.Level -eq 1) { 5 } elseif ($evt.Level -eq 2) { 4 } else { 3 }
                event_id = $evt.Id.ToString()
                source_ip = $env:COMPUTERNAME
                raw_log = @{ Id = $evt.Id; Provider = $evt.ProviderName; Level = $evt.Level }
            }
        }
    } catch { Write-Host "[WARN] Could not read System log: $_" -ForegroundColor Yellow }
    
    return $logs
}

function Send-Logs {
    param($ApiEndpoint, $ApiKey, $Logs)
    
    if ($Logs.Count -eq 0) {
        Write-Host "[INFO] No new logs to send" -ForegroundColor Gray
        return $true
    }
    
    $url = "$ApiEndpoint/agent-gateway/ingest"
    $body = @{ logs = $Logs } | ConvertTo-Json -Depth 10 -Compress
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
            "X-Agent-Key" = $ApiKey
            "User-Agent" = "SOCMind-Agent-Windows/2.1.0"
        }
        $resp = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -TimeoutSec 60
        Write-Host "[OK] Sent $($Logs.Count) logs -> $($resp.processed) processed, $($resp.incidents_created) incidents" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "[ERR] Failed to send logs: $_" -ForegroundColor Red
        return $false
    }
}

# ========== Commands ==========
function Invoke-Configure {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  SOCMind Windows Agent - Configuration" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    $existing = Read-Config
    
    $apiEndpoint = Read-Host "API Endpoint (e.g., https://kglmzurhiiuhxmzykkqv.supabase.co/functions/v1)"
    if ([string]::IsNullOrWhiteSpace($apiEndpoint) -and $existing) {
        $apiEndpoint = $existing["api_endpoint"]
        Write-Host "  Using existing: $apiEndpoint" -ForegroundColor Gray
    }
    
    $apiKey = Read-Host "API Key (socm_...)"
    if ([string]::IsNullOrWhiteSpace($apiKey) -and $existing) {
        $apiKey = $existing["api_key"]
        Write-Host "  Using existing: $($apiKey.Substring(0,12))..." -ForegroundColor Gray
    }
    
    $licenseKey = Read-Host "License Key (SOCM-XXXX-XXXX-XXXX-XXXX)"
    if ([string]::IsNullOrWhiteSpace($licenseKey) -and $existing) {
        $licenseKey = $existing["license_key"]
        Write-Host "  Using existing: $($licenseKey.Substring(0,9))..." -ForegroundColor Gray
    }
    
    if ([string]::IsNullOrWhiteSpace($apiEndpoint) -or [string]::IsNullOrWhiteSpace($apiKey) -or [string]::IsNullOrWhiteSpace($licenseKey)) {
        Write-Host "[FATAL] All fields are required!" -ForegroundColor Red
        return
    }
    
    Write-Config -ApiKey $apiKey -ApiEndpoint $apiEndpoint -LicenseKey $licenseKey
    
    Write-Host ""
    Write-Host "[INFO] Validating license..." -ForegroundColor Cyan
    $valid = Invoke-LicenseValidation -ApiEndpoint $apiEndpoint -ApiKey $apiKey -LicenseKey $licenseKey
    
    if ($valid) {
        Write-Host ""
        Write-Host "[OK] Configuration complete! Run './socmind-agent-windows.ps1 run' to start." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "[WARN] License validation failed. Check your license key." -ForegroundColor Yellow
    }
}

function Invoke-Run {
    $cfg = Read-Config
    if (-not $cfg -or -not $cfg["api_key"] -or -not $cfg["api_endpoint"]) {
        Write-Host "[FATAL] Not configured. Run './socmind-agent-windows.ps1 configure' first." -ForegroundColor Red
        return
    }
    
    $apiKey = $cfg["api_key"]
    $apiEndpoint = $cfg["api_endpoint"]
    $licenseKey = $cfg["license_key"]
    
    # Prompt for license if missing
    if ([string]::IsNullOrWhiteSpace($licenseKey)) {
        Write-Host "[INFO] License key not configured." -ForegroundColor Yellow
        $licenseKey = Read-Host "Enter license key (SOCM-XXXX-XXXX-XXXX-XXXX)"
        if ([string]::IsNullOrWhiteSpace($licenseKey)) {
            Write-Host "[FATAL] License key required!" -ForegroundColor Red
            return
        }
        # Update config
        Write-Config -ApiKey $apiKey -ApiEndpoint $apiEndpoint -LicenseKey $licenseKey
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  SOCMind Windows Agent v2.1.0" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Validate license before starting
    Write-Host "[INFO] Validating license..." -ForegroundColor Cyan
    $valid = Invoke-LicenseValidation -ApiEndpoint $apiEndpoint -ApiKey $apiKey -LicenseKey $licenseKey
    
    if (-not $valid) {
        Write-Host "[FATAL] License validation failed. Agent cannot start." -ForegroundColor Red
        return
    }
    
    Write-Host ""
    Write-Host "[INFO] Starting log collection (Ctrl+C to stop)..." -ForegroundColor Cyan
    Write-Host ""
    
    $interval = 60  # seconds
    $lastValidation = Get-Date
    $validationInterval = 3600  # re-validate every hour
    
    while ($true) {
        try {
            # Periodic license re-validation
            if (((Get-Date) - $lastValidation).TotalSeconds -ge $validationInterval) {
                Write-Host "[INFO] Re-validating license..." -ForegroundColor Gray
                $valid = Invoke-LicenseValidation -ApiEndpoint $apiEndpoint -ApiKey $apiKey -LicenseKey $licenseKey
                if (-not $valid) {
                    Write-Host "[FATAL] License expired or invalid. Stopping agent." -ForegroundColor Red
                    break
                }
                $lastValidation = Get-Date
            }
            
            # Collect and send logs
            $logs = Get-SecurityLogs -MaxEvents 50
            Send-Logs -ApiEndpoint $apiEndpoint -ApiKey $apiKey -Logs $logs | Out-Null
            
            # Heartbeat
            try {
                $heartbeatUrl = "$apiEndpoint/agent-gateway/heartbeat"
                $heartbeatBody = @{
                    hostname = $env:COMPUTERNAME
                    status = "active"
                    logs_sent = $logs.Count
                    ip_address = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -First 1).IPAddress
                } | ConvertTo-Json
                Invoke-RestMethod -Uri $heartbeatUrl -Method Post -Headers @{ "X-Agent-Key" = $apiKey; "Content-Type" = "application/json" } -Body $heartbeatBody -TimeoutSec 10 | Out-Null
            } catch { }
            
            Start-Sleep -Seconds $interval
        } catch {
            Write-Host "[ERR] Collection error: $_" -ForegroundColor Red
            Start-Sleep -Seconds 10
        }
    }
}

function Show-Status {
    $cfg = Read-Config
    Write-Host ""
    Write-Host "SOCMind Agent Status" -ForegroundColor Cyan
    Write-Host "====================" -ForegroundColor Cyan
    
    if (-not $cfg) {
        Write-Host "Status: NOT CONFIGURED" -ForegroundColor Red
    } else {
        Write-Host "API Endpoint: $($cfg["api_endpoint"])" -ForegroundColor Gray
        Write-Host "API Key: $($cfg["api_key"].Substring(0,12))..." -ForegroundColor Gray
        $lic = $cfg["license_key"]
        if ($lic) {
            Write-Host "License: $($lic.Substring(0,9))..." -ForegroundColor Gray
        } else {
            Write-Host "License: NOT SET" -ForegroundColor Yellow
        }
        Write-Host "Hardware ID: $(Get-HardwareId)" -ForegroundColor Gray
    }
    Write-Host ""
}

function Show-Help {
    Write-Host ""
    Write-Host "SOCMind Windows Agent v2.1.0" -ForegroundColor Cyan
    Write-Host "============================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor White
    Write-Host "  configure  - Set up API credentials and license" -ForegroundColor Gray
    Write-Host "  run        - Start the agent (collects & sends logs)" -ForegroundColor Gray
    Write-Host "  status     - Check agent configuration status" -ForegroundColor Gray
    Write-Host "  help       - Show this message" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor White
    Write-Host "  .\socmind-agent-windows.ps1 configure" -ForegroundColor Gray
    Write-Host "  .\socmind-agent-windows.ps1 run" -ForegroundColor Gray
    Write-Host ""
}

# ========== Main ==========
switch ($Command.ToLower()) {
    "configure" { Invoke-Configure }
    "run"       { Invoke-Run }
    "start"     { Invoke-Run }
    "status"    { Show-Status }
    "help"      { Show-Help }
    default     { Show-Help }
}
