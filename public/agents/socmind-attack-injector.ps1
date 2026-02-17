# SOCMind Attack Log Injector v1.0
# Inject attack simulation logs directly via API (no agent needed)
# Usage: .\socmind-attack-injector.ps1 -ApiEndpoint "https://..." -ApiKey "socm_..." [-Scenario "all"]

param(
    [Parameter(Mandatory=$true)][string]$ApiEndpoint,
    [Parameter(Mandatory=$true)][string]$ApiKey,
    [string]$Scenario = "all",
    [string]$AttackerIP = "",
    [string]$TargetIP = ""
)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not $AttackerIP) { $AttackerIP = "10.0.0.$(Get-Random -Min 50 -Max 254)" }
if (-not $TargetIP) { $TargetIP = "192.168.1.$(Get-Random -Min 2 -Max 254)" }

Write-Host ""
Write-Host "============================================" -ForegroundColor Red
Write-Host "  SOCMind ATTACK LOG INJECTOR v1.0" -ForegroundColor Red
Write-Host "  Attacker: $AttackerIP -> Target: $TargetIP" -ForegroundColor Yellow
Write-Host "  Scenario: $Scenario" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Red

$logs = @()

# Nmap
if ($Scenario -in @("all","nmap")) {
    @(22,80,443,445,3389,8080,3306,5432,1433,6379) | ForEach-Object {
        $logs += @{ log_type="security"; source_ip=$AttackerIP; dst_ip=$TargetIP; severity=4; event_type="port_scan"
            timestamp=(Get-Date).AddSeconds(-$(Get-Random -Min 1 -Max 30)).ToUniversalTime().ToString("o")
            message="TCP SYN scan: $AttackerIP -> ${TargetIP}:$_"; event_id="5156"
            mitre_tactic="Discovery"; mitre_technique="T1046"
            raw_log=@{src_ip=$AttackerIP;dst_ip=$TargetIP;dst_port=$_;flags="SYN"} }
    }
    Write-Host "[+] 10 port scan events" -ForegroundColor Yellow
}

# Brute Force
if ($Scenario -in @("all","brute")) {
    @("admin","administrator","root","user","test") | ForEach-Object {
        for ($i=0;$i -lt 8;$i++) {
            $logs += @{ log_type="security"; source_ip=$AttackerIP; dst_ip=$TargetIP; severity=4; event_type="brute_force"
                timestamp=(Get-Date).AddSeconds(-$(Get-Random -Min 1 -Max 120)).ToUniversalTime().ToString("o")
                message="Login failure: '$_' from $AttackerIP (attempt $($i+1))"; event_id="4625"
                mitre_tactic="Credential Access"; mitre_technique="T1110"
                raw_log=@{src_ip=$AttackerIP;username=$_;failure_reason="Bad password"} }
        }
    }
    $logs += @{ log_type="security"; source_ip=$AttackerIP; dst_ip=$TargetIP; severity=5; event_type="suspicious_login"
        timestamp=(Get-Date).ToUniversalTime().ToString("o")
        message="SUCCESSFUL LOGIN after 40 failures: 'administrator' from $AttackerIP"; event_id="4624"
        mitre_tactic="Initial Access"; mitre_technique="T1078"
        raw_log=@{src_ip=$AttackerIP;username="administrator";after_failures=40} }
    Write-Host "[+] 41 brute force events" -ForegroundColor Yellow
}

# C2
if ($Scenario -in @("all","c2")) {
    $c2="185.$(Get-Random -Min 100 -Max 255).$(Get-Random -Min 1 -Max 255).$(Get-Random -Min 1 -Max 255)"
    for ($i=0;$i -lt 15;$i++) {
        $logs += @{ log_type="security"; source_ip=$TargetIP; dst_ip=$c2; severity=5; event_type="c2_communication"
            timestamp=(Get-Date).AddSeconds(-($i*30)).ToUniversalTime().ToString("o")
            message="Beacon: $TargetIP -> ${c2}:443 interval=30s"; event_id="5156"
            mitre_tactic="Command and Control"; mitre_technique="T1071"
            raw_log=@{src_ip=$TargetIP;dst_ip=$c2;interval=30} }
    }
    Write-Host "[+] 15 C2 events" -ForegroundColor Yellow
}

# Lateral Movement
if ($Scenario -in @("all","lateral")) {
    @("192.168.1.10","192.168.1.20","192.168.1.30","192.168.1.50") | ForEach-Object {
        $logs += @{ log_type="security"; source_ip=$AttackerIP; dst_ip=$_; severity=5; event_type="lateral_movement"
            timestamp=(Get-Date).AddSeconds(-$(Get-Random -Min 1 -Max 60)).ToUniversalTime().ToString("o")
            message="SMB ADMIN$ access: $AttackerIP -> $_ (PsExec)"; event_id="5140"
            mitre_tactic="Lateral Movement"; mitre_technique="T1021.002"
            raw_log=@{src_ip=$AttackerIP;dst_ip=$_;share="ADMIN$"} }
    }
    Write-Host "[+] 4 lateral movement events" -ForegroundColor Yellow
}

# Exfiltration
if ($Scenario -in @("all","exfil")) {
    $exfil="103.$(Get-Random -Min 1 -Max 255).$(Get-Random -Min 1 -Max 255).$(Get-Random -Min 1 -Max 255)"
    for ($i=0;$i -lt 5;$i++) {
        $sz=Get-Random -Min 50 -Max 500
        $logs += @{ log_type="security"; source_ip=$TargetIP; dst_ip=$exfil; severity=5; event_type="data_exfiltration"
            timestamp=(Get-Date).AddSeconds(-($i*10)).ToUniversalTime().ToString("o")
            message="Large transfer: $TargetIP -> ${exfil}:443 ${sz}MB"; event_id="5156"
            mitre_tactic="Exfiltration"; mitre_technique="T1041"
            raw_log=@{src_ip=$TargetIP;dst_ip=$exfil;bytes=$sz*1MB} }
    }
    Write-Host "[+] 5 exfiltration events" -ForegroundColor Yellow
}

Write-Host "`n[TOTAL] $($logs.Count) events to inject" -ForegroundColor Cyan

# Send in batches
for ($i=0; $i -lt $logs.Count; $i+=10) {
    $batch = $logs[$i..([Math]::Min($i+9, $logs.Count-1))]
    try {
        $body = @{logs=$batch} | ConvertTo-Json -Depth 10 -Compress
        $resp = Invoke-RestMethod -Uri "$ApiEndpoint/agent-gateway/ingest" -Method Post -Body $body -TimeoutSec 60 `
            -Headers @{"Content-Type"="application/json";"X-Agent-Key"=$ApiKey;"User-Agent"="SOCMind-Injector/1.0"}
        Write-Host "[OK] Batch $([Math]::Floor($i/10)+1): $($batch.Count) -> $($resp.processed) processed, $($resp.incidents_created) incidents" -ForegroundColor Green
    } catch {
        Write-Host "[ERR] Batch failed: $_" -ForegroundColor Red
    }
    Start-Sleep -Seconds 1
}

Write-Host "`n[DONE] Check Dashboard for incidents!" -ForegroundColor Green
