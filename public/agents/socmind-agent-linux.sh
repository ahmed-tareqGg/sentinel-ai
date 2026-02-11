#!/bin/bash
# SOCMind Linux Agent v3.0.0 - Universal Executor
# Copyright (c) 2025 SOCMind. All rights reserved.
# Contact: security@socmind.ai
# Capabilities: Log Collector + Action Executor + IOC Enforcer + Playbook Runner

# Note: Do NOT use 'set -e' — many commands (grep, dd, pkill) return
# non-zero exit codes during normal operation, which would kill the agent.
set +e

AGENT_VERSION="3.0.0"
CONFIG_FILE="$(dirname "$0")/agent.conf"
ACTION_LOG="$(dirname "$0")/action_log.json"
QUARANTINE_DIR="/var/socmind/quarantine"

# ========== Colors ==========
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; NC='\033[0m'

# ========== Configuration ==========
read_config() {
    if [ ! -f "$CONFIG_FILE" ]; then echo ""; return; fi
    grep -E "^\s*$1\s*=" "$CONFIG_FILE" 2>/dev/null | head -1 | sed 's/.*=\s*//' | tr -d '"' | tr -d "'"
}

write_config() {
    cat > "$CONFIG_FILE" << EOF
[agent]
api_key = $1
api_endpoint = $2
license_key = $3
mode = executor
EOF
    echo -e "${GREEN}[OK] Configuration saved${NC}"
}

# ========== Hardware ID ==========
get_hardware_id() {
    local components=""
    [ -f /etc/machine-id ] && components=$(cat /etc/machine-id)
    components="${components}-$(hostname)"
    components="${components}-$(cat /sys/class/net/*/address 2>/dev/null | head -1 || echo 'unknown')"
    echo -n "$components" | sha256sum | cut -c1-32
}

# ========== License Validation ==========
validate_license() {
    local endpoint="$1" key="$2" license="$3"
    
    if [[ ! "$license" =~ ^SOCM-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$ ]]; then
        echo -e "${RED}[ERR] Invalid license format${NC}"; return 1
    fi
    
    local hwid=$(get_hardware_id)
    local payload=$(echo -n "{\"license_key\":\"$license\",\"hardware_id\":\"$hwid\",\"agent_version\":\"$AGENT_VERSION\",\"platform\":\"linux\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" | base64 -w0)
    
    local resp=$(curl -s -X POST "$endpoint/agent-gateway/validate-license" \
        -H "Content-Type: application/json" \
        -H "X-Agent-Key: $key" \
        -H "User-Agent: SOCMind-Agent-Linux/$AGENT_VERSION" \
        -d "{\"payload\":\"$payload\"}" --connect-timeout 30)
    
    if echo "$resp" | grep -q '"is_valid":true'; then
        local ltype=$(echo "$resp" | grep -o '"license_type":"[^"]*"' | cut -d'"' -f4)
        local org=$(echo "$resp" | grep -o '"organization_name":"[^"]*"' | cut -d'"' -f4)
        echo -e "${GREEN}[LICENSE:VALID] Type: $ltype | Org: $org${NC}"
        return 0
    else
        local err=$(echo "$resp" | grep -o '"error_message":"[^"]*"' | cut -d'"' -f4)
        echo -e "${RED}[LICENSE:INVALID] $err${NC}"
        return 1
    fi
}

# ========== Log Collection ==========
POSITION_DIR="/tmp/socmind_positions"

collect_logs() {
    local max_lines=${1:-100}
    local logs="[]"
    local found_any="false"
    mkdir -p "$POSITION_DIR"
    
    # Method 1: Traditional log files
    for logfile in /var/log/auth.log /var/log/secure /var/log/syslog /var/log/messages /var/log/kern.log /var/log/daemon.log /var/log/faillog /var/log/lastlog /var/log/dpkg.log /var/log/apt/history.log; do
        [ ! -f "$logfile" ] && continue
        [ ! -r "$logfile" ] && continue
        found_any="true"
        
        local pos_file="$POSITION_DIR/$(echo "$logfile" | md5sum | cut -c1-16)"
        local last_size=0
        [ -f "$pos_file" ] && last_size=$(cat "$pos_file" 2>/dev/null || echo 0)
        local current_size=$(stat -c%s "$logfile" 2>/dev/null || stat -f%z "$logfile" 2>/dev/null || echo 0)
        
        # File rotated or first run
        if [ "$current_size" -lt "$last_size" ] 2>/dev/null; then
            last_size=0
        fi
        
        # No new data
        if [ "$current_size" -eq "$last_size" ] 2>/dev/null; then
            continue
        fi
        
        local logtype="system"
        echo "$logfile" | grep -qi "auth\|secure\|faillog\|lastlog" && logtype="auth"
        echo "$logfile" | grep -qi "kern" && logtype="kernel"
        echo "$logfile" | grep -qi "dpkg\|apt" && logtype="package"
        
        local new_lines=""
        if [ "$last_size" -eq 0 ]; then
            new_lines=$(tail -n "$max_lines" "$logfile" 2>/dev/null || true)
        else
            new_lines=$(dd if="$logfile" bs=1 skip="$last_size" 2>/dev/null | head -n "$max_lines" || true)
        fi
        
        echo "$current_size" > "$pos_file"
        
        while IFS= read -r line; do
            [ -z "$line" ] && continue
            local severity=2
            
            # High severity: brute force, failed passwords, authentication failures
            if echo "$line" | grep -qi "Failed password\|authentication failure\|FAILED LOGIN\|invalid user\|illegal user\|maximum authentication\|Too many authentication\|pam_unix.*failed\|Connection closed.*preauth\|Disconnected from authenticating"; then
                severity=5
            elif echo "$line" | grep -qi "critical\|emergency\|panic"; then
                severity=5
            elif echo "$line" | grep -qi "failed\|denied\|error\|attack\|blocked\|invalid\|unauthorized\|rejected"; then
                severity=4
            elif echo "$line" | grep -qi "warning\|warn\|suspicious"; then
                severity=3
            fi
            
            # Detect MITRE techniques from log content
            local mitre=""
            echo "$line" | grep -qi "Failed password\|authentication failure\|FAILED LOGIN" && mitre="T1110"
            echo "$line" | grep -qi "sudo.*COMMAND\|su:" && mitre="T1548"
            echo "$line" | grep -qi "Accepted publickey\|Accepted password" && mitre="T1078"
            echo "$line" | grep -qi "session opened\|session closed" && mitre="T1021"
            
            local safe_msg=$(echo "$line" | head -c 500 | sed "s/'/\\\\'/g" | sed 's/"/\\"/g' | tr -d '\000-\037' || true)
            logs=$(echo "$logs" | python3 -c "
import sys, json
logs = json.load(sys.stdin)
entry = {'log_type':'$logtype','timestamp':'$(date -u +%Y-%m-%dT%H:%M:%SZ)','message':'$safe_msg','severity':$severity,'source_ip':'$(hostname)','raw_log':{'file':'$logfile'}}
mitre = '$mitre'
if mitre:
    entry['mitre_technique'] = mitre
logs.append(entry)
print(json.dumps(logs))
" 2>/dev/null || echo "$logs")
        done <<< "$new_lines"
    done
    
    # Method 2: journalctl fallback (systemd-based systems like Kali, Ubuntu 22+, Fedora)
    if [ "$found_any" == "false" ] || [ "$logs" == "[]" ]; then
        if command -v journalctl &> /dev/null; then
            local journal_pos_file="$POSITION_DIR/journalctl_cursor"
            local journal_args="--no-pager -o short-iso -q -n $max_lines"
            
            if [ -f "$journal_pos_file" ]; then
                local cursor=$(cat "$journal_pos_file" 2>/dev/null)
                if [ -n "$cursor" ]; then
                    journal_args="--no-pager -o short-iso -q --after-cursor=$cursor -n $max_lines"
                fi
            fi
            
            local journal_output=""
            journal_output=$(journalctl $journal_args 2>/dev/null || true)
            
            # Save cursor for next run
            journalctl --no-pager -o export -n 1 2>/dev/null | grep "^__CURSOR=" | cut -d= -f2 > "$journal_pos_file" 2>/dev/null || true
            
            while IFS= read -r line; do
                [ -z "$line" ] && continue
                [[ "$line" == *"-- No entries --"* ]] && continue
                [[ "$line" == *"-- Journal begins"* ]] && continue
                local severity=2
                
                if echo "$line" | grep -qi "Failed password\|authentication failure\|FAILED LOGIN\|invalid user\|illegal user\|maximum authentication\|pam_unix.*failed"; then
                    severity=5
                elif echo "$line" | grep -qi "critical\|emergency\|panic"; then
                    severity=5
                elif echo "$line" | grep -qi "failed\|denied\|error\|attack\|blocked\|invalid"; then
                    severity=4
                elif echo "$line" | grep -qi "warning\|warn\|suspicious"; then
                    severity=3
                fi
                
                local logtype="system"
                echo "$line" | grep -qi "sshd\|sudo\|login\|pam\|auth\|passwd" && logtype="auth"
                echo "$line" | grep -qi "kernel" && logtype="kernel"
                
                local mitre=""
                echo "$line" | grep -qi "Failed password\|authentication failure" && mitre="T1110"
                echo "$line" | grep -qi "sudo.*COMMAND\|su:" && mitre="T1548"
                
                local safe_msg=$(echo "$line" | head -c 500 | sed "s/'/\\\\'/g" | sed 's/"/\\"/g' | tr -d '\000-\037' || true)
                logs=$(echo "$logs" | python3 -c "
import sys, json
logs = json.load(sys.stdin)
entry = {'log_type':'$logtype','timestamp':'$(date -u +%Y-%m-%dT%H:%M:%SZ)','message':'$safe_msg','severity':$severity,'source_ip':'$(hostname)','raw_log':{'source':'journalctl'}}
mitre = '$mitre'
if mitre:
    entry['mitre_technique'] = mitre
logs.append(entry)
print(json.dumps(logs))
" 2>/dev/null || echo "$logs")
            done <<< "$journal_output"
        fi
    fi
    
    echo "$logs"
}

send_logs() {
    local endpoint="$1" key="$2" logs="$3"
    [ "$logs" = "[]" ] && echo -e "${CYAN}[INFO] No new logs${NC}" && return
    
    local resp=$(curl -s -X POST "$endpoint/agent-gateway/ingest" \
        -H "Content-Type: application/json" \
        -H "X-Agent-Key: $key" \
        -d "{\"logs\":$logs}" --connect-timeout 60)
    
    local processed=$(echo "$resp" | grep -o '"logs_received":[0-9]*' | cut -d: -f2)
    local incidents=$(echo "$resp" | grep -o '"incidents_created":[0-9]*' | cut -d: -f2)
    echo -e "${GREEN}[OK] Sent logs -> ${processed:-0} processed, ${incidents:-0} incidents${NC}"
}

# ========== ACTION EXECUTION ENGINE ==========
log_action() {
    local action_id="$1" action_type="$2" target="$3" status="$4" details="$5"
    local entry="{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"action_id\":\"$action_id\",\"action_type\":\"$action_type\",\"target\":\"$target\",\"status\":\"$status\",\"details\":\"$details\"}"
    
    if [ -f "$ACTION_LOG" ]; then
        local existing=$(cat "$ACTION_LOG")
        echo "$existing" | python3 -c "
import sys, json
data = json.load(sys.stdin)
data.append(json.loads('$entry'))
print(json.dumps(data, indent=2))
" > "$ACTION_LOG" 2>/dev/null || echo "[$entry]" > "$ACTION_LOG"
    else
        echo "[$entry]" > "$ACTION_LOG"
    fi
}

execute_action() {
    local action_json="$1"
    local dry_run="$2"
    
    local action_type=$(echo "$action_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('action_type',''))")
    local target=$(echo "$action_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('target',''))")
    local action_id=$(echo "$action_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('action_id',''))")
    local db_id=$(echo "$action_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
    local exec_mode=$(echo "$action_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('execution_mode','real'))")
    local duration=$(echo "$action_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('duration_seconds',0))")
    
    local is_dry=$([[ "$dry_run" == "true" || "$exec_mode" == "dry_run" || "$exec_mode" == "simulation" ]] && echo "true" || echo "false")
    
    echo -e ""
    echo -e "${MAGENTA}========================================${NC}"
    echo -e "${MAGENTA}  SOAR ACTION: $action_type${NC}"
    echo -e "${MAGENTA}  Target: $target${NC}"
    if [ "$is_dry" == "true" ]; then
        echo -e "${YELLOW}  Mode: SIMULATION${NC}"
    else
        echo -e "${RED}  Mode: REAL${NC}"
    fi
    echo -e "${MAGENTA}========================================${NC}"
    
    local success="true"
    local details=""
    local rollback="false"
    
    case "$action_type" in
        "block_ip")
            if [ "$is_dry" == "true" ]; then
                details="DRY-RUN: Would block IP $target via iptables"
            else
                iptables -A INPUT -s "$target" -j DROP 2>/dev/null && \
                iptables -A OUTPUT -d "$target" -j DROP 2>/dev/null
                details="Blocked IP $target (iptables INPUT+OUTPUT DROP)"
                rollback="true"
            fi
            ;;
        "unblock_ip")
            if [ "$is_dry" == "true" ]; then
                details="DRY-RUN: Would unblock IP $target"
            else
                iptables -D INPUT -s "$target" -j DROP 2>/dev/null
                iptables -D OUTPUT -d "$target" -j DROP 2>/dev/null
                details="Unblocked IP $target"
            fi
            ;;
        "kill_process")
            if [ "$is_dry" == "true" ]; then
                details="DRY-RUN: Would kill process $target"
            else
                pkill -f "$target" 2>/dev/null && details="Killed process(es): $target" || details="No process found: $target"
            fi
            ;;
        "disable_user")
            if [ "$is_dry" == "true" ]; then
                details="DRY-RUN: Would disable user $target"
            else
                passwd -l "$target" 2>/dev/null
                details="User $target locked"
                rollback="true"
                if [ "$duration" -gt 0 ] 2>/dev/null; then
                    (sleep "$duration" && passwd -u "$target" 2>/dev/null) &
                    details="$details (auto-unlock in ${duration}s)"
                fi
            fi
            ;;
        "enable_user")
            if [ "$is_dry" == "true" ]; then
                details="DRY-RUN: Would enable user $target"
            else
                passwd -u "$target" 2>/dev/null
                details="User $target unlocked"
            fi
            ;;
        "lock_account")
            if [ "$is_dry" == "true" ]; then
                details="DRY-RUN: Would lock account $target"
            else
                usermod -L "$target" 2>/dev/null
                details="Account $target locked"
                rollback="true"
                if [ "$duration" -gt 0 ] 2>/dev/null; then
                    (sleep "$duration" && usermod -U "$target" 2>/dev/null) &
                fi
            fi
            ;;
        "stop_service")
            if [ "$is_dry" == "true" ]; then
                details="DRY-RUN: Would stop service $target"
            else
                systemctl stop "$target" 2>/dev/null && details="Service $target stopped" || details="Failed to stop $target"
                rollback="true"
            fi
            ;;
        "start_service")
            if [ "$is_dry" == "true" ]; then
                details="DRY-RUN: Would start service $target"
            else
                systemctl start "$target" 2>/dev/null && details="Service $target started" || { details="Failed to start $target"; success="false"; }
            fi
            ;;
        "quarantine_file")
            if [ "$is_dry" == "true" ]; then
                details="DRY-RUN: Would quarantine file $target"
            else
                mkdir -p "$QUARANTINE_DIR"
                if [ -f "$target" ]; then
                    local fname=$(basename "$target")
                    mv "$target" "$QUARANTINE_DIR/${fname}.quarantined"
                    chmod 000 "$QUARANTINE_DIR/${fname}.quarantined"
                    details="File quarantined: $target -> $QUARANTINE_DIR/${fname}.quarantined"
                    rollback="true"
                else
                    details="File not found: $target"; success="false"
                fi
            fi
            ;;
        "delete_file")
            if [ "$is_dry" == "true" ]; then
                details="DRY-RUN: Would delete file $target"
            else
                if [ -f "$target" ]; then
                    rm -f "$target"
                    details="File deleted: $target"
                else
                    details="File not found: $target"; success="false"
                fi
            fi
            ;;
        "isolate_host")
            if [ "$is_dry" == "true" ]; then
                details="DRY-RUN: Would isolate host"
            else
                # Save existing rules
                iptables-save > /tmp/socmind_pre_isolate.rules 2>/dev/null
                # Block all, allow only SOCMind
                iptables -P OUTPUT DROP 2>/dev/null
                iptables -P INPUT DROP 2>/dev/null
                iptables -A INPUT -i lo -j ACCEPT 2>/dev/null
                iptables -A OUTPUT -o lo -j ACCEPT 2>/dev/null
                # Allow DNS and SOCMind gateway
                iptables -A OUTPUT -p udp --dport 53 -j ACCEPT 2>/dev/null
                iptables -A INPUT -p udp --sport 53 -j ACCEPT 2>/dev/null
                iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null
                iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null
                details="Host isolated. Only DNS and HTTPS allowed."
                rollback="true"
            fi
            ;;
        "unisolate_host")
            if [ "$is_dry" == "true" ]; then
                details="DRY-RUN: Would remove host isolation"
            else
                if [ -f /tmp/socmind_pre_isolate.rules ]; then
                    iptables-restore < /tmp/socmind_pre_isolate.rules 2>/dev/null
                    details="Host isolation removed (rules restored)"
                else
                    iptables -P INPUT ACCEPT 2>/dev/null
                    iptables -P OUTPUT ACCEPT 2>/dev/null
                    iptables -F 2>/dev/null
                    details="Host isolation removed (default accept)"
                fi
            fi
            ;;
        *)
            details="Unknown action type: $action_type"; success="false"
            ;;
    esac
    
    local status_str=$([[ "$success" == "true" ]] && echo "completed" || echo "failed")
    log_action "$action_id" "$action_type" "$target" "$status_str" "$details"
    
    if [ "$success" == "true" ]; then
        echo -e "${GREEN}[OK] $details${NC}"
    else
        echo -e "${RED}[ERR] $details${NC}"
    fi
    
    # Report result back to platform
    report_action_result "$db_id" "$success" "$details" "$rollback"
}

report_action_result() {
    local db_id="$1" success="$2" details="$3" rollback="$4"
    local endpoint=$(read_config "api_endpoint")
    local key=$(read_config "api_key")
    
    local status_val=$([[ "$success" == "true" ]] && echo "success" || echo "failed")
    local err_msg=$([[ "$success" != "true" ]] && echo "\"$details\"" || echo "null")
    
    curl -s -X POST "$endpoint/agent-gateway/report-action" \
        -H "Content-Type: application/json" \
        -H "X-Agent-Key: $key" \
        -d "{\"action_id\":\"$db_id\",\"status\":\"$status_val\",\"result\":{\"details\":\"$details\"},\"error_message\":$err_msg,\"rollback_available\":$rollback}" \
        --connect-timeout 15 > /dev/null 2>&1
}

poll_actions() {
    local endpoint="$1" key="$2"
    curl -s -X POST "$endpoint/agent-gateway/poll-actions" \
        -H "Content-Type: application/json" \
        -H "X-Agent-Key: $key" \
        -d "{}" --connect-timeout 15 2>/dev/null
}

send_heartbeat() {
    local endpoint="$1" key="$2"
    local ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "unknown")
    curl -s -X POST "$endpoint/agent-gateway/heartbeat" \
        -H "Content-Type: application/json" \
        -H "X-Agent-Key: $key" \
        -d "{\"hostname\":\"$(hostname)\",\"status\":\"active\",\"ip_address\":\"$ip\",\"agent_version\":\"$AGENT_VERSION\",\"capabilities\":[\"collector\",\"executor\",\"ioc_enforcer\"]}" \
        --connect-timeout 10 > /dev/null 2>&1
}

# ========== Commands ==========
cmd_configure() {
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}  SOCMind Linux Agent v$AGENT_VERSION - Configuration${NC}"
    echo -e "${CYAN}  Mode: Universal Executor${NC}"
    echo -e "${CYAN}============================================${NC}"
    echo ""
    read -p "API Endpoint: " api_endpoint
    read -p "API Key (socm_...): " api_key
    read -p "License Key (SOCM-XXXX-XXXX-XXXX-XXXX): " license_key
    
    [ -z "$api_endpoint" ] || [ -z "$api_key" ] || [ -z "$license_key" ] && { echo -e "${RED}[FATAL] All fields required!${NC}"; exit 1; }
    
    write_config "$api_key" "$api_endpoint" "$license_key"
    validate_license "$api_endpoint" "$api_key" "$license_key"
}

cmd_run() {
    local dry_run="false"
    [[ "$1" == "--dry-run" ]] && dry_run="true"
    
    local endpoint=$(read_config "api_endpoint")
    local key=$(read_config "api_key")
    local license=$(read_config "license_key")
    
    [ -z "$endpoint" ] || [ -z "$key" ] && { echo -e "${RED}[FATAL] Not configured. Run '$0 configure' first.${NC}"; exit 1; }
    [ -z "$license" ] && { read -p "Enter license key: " license; [ -z "$license" ] && exit 1; }
    
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}  SOCMind Linux Agent v$AGENT_VERSION${NC}"
    echo -e "${CYAN}  Capabilities: Collector + Executor + IOC${NC}"
    if [ "$dry_run" == "true" ]; then
        echo -e "${YELLOW}  Mode: DRY-RUN (Simulation)${NC}"
    else
        echo -e "${GREEN}  Mode: LIVE${NC}"
    fi
    echo -e "${CYAN}============================================${NC}"
    
    validate_license "$endpoint" "$key" "$license" || { echo -e "${RED}[FATAL] License invalid${NC}"; exit 1; }
    
    echo -e "${CYAN}[INFO] Starting agent (Ctrl+C to stop)...${NC}"
    
    local collection_interval=60
    local action_poll_interval=10
    local last_action_poll=0
    local last_validation=$(date +%s)
    
    while true; do
        # Collect and send logs
        local logs=$(collect_logs 50)
        send_logs "$endpoint" "$key" "$logs"
        
        # Poll for SOAR actions
        local now=$(date +%s)
        if [ $((now - last_action_poll)) -ge $action_poll_interval ]; then
            local actions_resp=$(poll_actions "$endpoint" "$key")
            local action_count=$(echo "$actions_resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('actions',[])))" 2>/dev/null || echo "0")
            
            if [ "$action_count" -gt 0 ]; then
                echo -e "${MAGENTA}[ACTION] Received $action_count action(s) from platform${NC}"
                echo "$actions_resp" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for a in data.get('actions', []):
    print(json.dumps(a))
" 2>/dev/null | while IFS= read -r action_line; do
                    execute_action "$action_line" "$dry_run"
                done
            fi
            last_action_poll=$now
        fi
        
        # Heartbeat
        send_heartbeat "$endpoint" "$key"
        
        # Re-validate license hourly
        if [ $((now - last_validation)) -ge 3600 ]; then
            validate_license "$endpoint" "$key" "$license" || { echo -e "${RED}[FATAL] License expired${NC}"; break; }
            last_validation=$now
        fi
        
        sleep $collection_interval
    done
}

cmd_status() {
    echo -e "${CYAN}SOCMind Agent v$AGENT_VERSION Status${NC}"
    echo -e "${CYAN}================================${NC}"
    local endpoint=$(read_config "api_endpoint")
    local key=$(read_config "api_key")
    local license=$(read_config "license_key")
    
    if [ -z "$endpoint" ]; then
        echo -e "${RED}Status: NOT CONFIGURED${NC}"
    else
        echo "API Endpoint: $endpoint"
        echo "API Key: ${key:0:12}..."
        [ -n "$license" ] && echo "License: ${license:0:9}..."
        echo "Hardware ID: $(get_hardware_id)"
        echo -e "${GREEN}Capabilities: Collector, Executor, IOC Enforcer${NC}"
    fi
    
    if [ -f "$ACTION_LOG" ]; then
        echo ""
        echo "Recent Actions:"
        python3 -c "
import json
with open('$ACTION_LOG') as f:
    data = json.load(f)
for a in data[-5:]:
    print(f\"  [{a['timestamp']}] {a['action_type']} -> {a['target']} = {a['status']}\")
" 2>/dev/null
    fi
}

cmd_help() {
    echo -e "${CYAN}SOCMind Linux Agent v$AGENT_VERSION - Universal Executor${NC}"
    echo -e "${CYAN}=====================================================${NC}"
    echo ""
    echo "Commands:"
    echo "  configure     - Set up API credentials and license"
    echo "  run           - Start agent (collect logs + execute actions)"
    echo "  run --dry-run - Start in simulation mode (no real actions)"
    echo "  status        - Check agent status and recent actions"
    echo "  help          - Show this message"
    echo ""
    echo "Supported Actions:"
    echo "  block_ip, unblock_ip, kill_process, disable_user, enable_user"
    echo "  lock_account, stop_service, start_service, quarantine_file"
    echo "  delete_file, isolate_host, unisolate_host"
    echo ""
}

# ========== Main ==========
case "${1:-help}" in
    configure) cmd_configure ;;
    run)       cmd_run "$2" ;;
    start)     cmd_run "$2" ;;
    status)    cmd_status ;;
    help)      cmd_help ;;
    *)         cmd_help ;;
esac
