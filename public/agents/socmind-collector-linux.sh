#!/bin/bash
# SOCMind Collector Agent v1.0.0 - Log Collector Only
# Copyright (c) 2025 SOCMind. All rights reserved.
# Contact: security@socmind.ai
#
# PURPOSE: Lightweight log collector — NO execution capabilities.
# Collects Linux system logs and ships them to the SOCMind platform.
# Deploy this on every endpoint.
#
# Usage:
#   ./socmind-collector-linux.sh configure   — First time setup
#   ./socmind-collector-linux.sh start       — Start collecting
#   ./socmind-collector-linux.sh test        — Single batch and exit
#   ./socmind-collector-linux.sh status      — Show config

set +e

AGENT_VERSION="1.0.0"
AGENT_ROLE="collector"
CONFIG_FILE="$(dirname "$0")/collector.conf"
POSITION_DIR="/tmp/socmind_collector_positions"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

# ========== Config ==========
read_config() {
    [ ! -f "$CONFIG_FILE" ] && echo "" && return
    grep -E "^\s*$1\s*=" "$CONFIG_FILE" 2>/dev/null | head -1 | sed 's/.*=\s*//' | tr -d '"' | tr -d "'"
}

write_config() {
    cat > "$CONFIG_FILE" << EOF
[collector]
api_key      = $1
api_endpoint = $2
role         = collector
EOF
    echo -e "${GREEN}[OK] collector.conf saved${NC}"
}

# ========== Log Collection ==========
collect_logs() {
    local max_lines=${1:-200}
    local logs="[]"
    local count=0
    mkdir -p "$POSITION_DIR"

    # --- Traditional log files ---
    for logfile in /var/log/auth.log /var/log/secure /var/log/syslog /var/log/messages /var/log/kern.log /var/log/daemon.log; do
        [ ! -f "$logfile" ] && continue
        [ ! -r "$logfile" ] && continue
        file "$logfile" 2>/dev/null | grep -qi "binary\|data\|executable" && continue

        local pos_file="$POSITION_DIR/$(echo "$logfile" | md5sum | cut -c1-16)"
        local last_size=0
        [ -f "$pos_file" ] && last_size=$(cat "$pos_file" 2>/dev/null || echo 0)
        local current_size
        current_size=$(stat -c%s "$logfile" 2>/dev/null || stat -f%z "$logfile" 2>/dev/null || echo 0)

        [ "$current_size" -lt "$last_size" ] 2>/dev/null && last_size=0

        if [ "$current_size" -le "$last_size" ]; then
            echo "$current_size" > "$pos_file"
            continue
        fi

        local new_lines
        new_lines=$(dd if="$logfile" bs=1 skip="$last_size" 2>/dev/null | tail -n "$max_lines")
        echo "$current_size" > "$pos_file"

        [ -z "$new_lines" ] && continue

        while IFS= read -r line; do
            [ -z "$line" ] && continue
            local safe_line
            safe_line=$(echo "$line" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/ /g' | tr -d '\000-\037')
            local sev=2
            echo "$safe_line" | grep -qi "error\|fail\|denied\|invalid\|unauthorized\|critical" && sev=4
            echo "$safe_line" | grep -qi "warn" && sev=3

            local log_type="system"
            echo "$logfile" | grep -qi "auth\|secure" && log_type="auth"
            echo "$logfile" | grep -qi "kern" && log_type="kernel"

            local entry="{\"log_type\":\"${log_type}\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"message\":\"${safe_line}\",\"severity\":${sev},\"source_ip\":\"$(hostname)\",\"event_type\":\"linux_syslog\",\"hostname\":\"$(hostname)\",\"raw_log\":{\"file\":\"${logfile}\"}}"
            if [ "$logs" = "[]" ]; then
                logs="[$entry]"
            else
                logs="${logs%]},${entry}]"
            fi
            count=$((count + 1))
            [ "$count" -ge "$max_lines" ] && break 2
        done <<< "$new_lines"
    done

    # --- journalctl fallback ---
    if [ "$count" -eq 0 ] && command -v journalctl &>/dev/null; then
        local cursor_file="$POSITION_DIR/journalctl_cursor"
        local cursor_arg=""
        [ -f "$cursor_file" ] && cursor_arg="--after-cursor=$(cat "$cursor_file")"
        
        local jlines
        jlines=$(journalctl -p warning..emerg $cursor_arg -n "$max_lines" --no-pager --output=short-iso 2>/dev/null)
        
        if [ -n "$jlines" ]; then
            # Save new cursor
            journalctl $cursor_arg -n 1 --show-cursor 2>/dev/null | grep "-- cursor:" | sed 's/-- cursor: //' > "$cursor_file"
            
            while IFS= read -r line; do
                [ -z "$line" ] && continue
                local safe_line
                safe_line=$(echo "$line" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\000-\037')
                local sev=3
                echo "$safe_line" | grep -qi "error\|crit\|emerg\|alert" && sev=4

                local entry="{\"log_type\":\"system\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"message\":\"${safe_line}\",\"severity\":${sev},\"source_ip\":\"$(hostname)\",\"event_type\":\"linux_journal\",\"hostname\":\"$(hostname)\",\"raw_log\":{\"source\":\"journalctl\"}}"
                if [ "$logs" = "[]" ]; then
                    logs="[$entry]"
                else
                    logs="${logs%]},${entry}]"
                fi
                count=$((count + 1))
            done <<< "$jlines"
        fi
    fi

    echo "$logs"
}

# ========== Send ==========
send_logs() {
    local endpoint="$1" key="$2" logs="$3"
    local count
    count=$(echo "$logs" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo 0)

    if [ "$count" -eq 0 ]; then
        echo -e "$(date '+%H:%M:%S') ${NC}No new events - monitoring..."
        return 0
    fi

    local body="{\"logs\":${logs}}"
    local resp
    resp=$(curl -s -X POST "$endpoint/agent-gateway/ingest" \
        -H "Content-Type: application/json" \
        -H "X-Agent-Key: $key" \
        -H "User-Agent: SOCMind-Collector-Linux/$AGENT_VERSION" \
        -d "$body" --max-time 120 2>&1)

    if echo "$resp" | grep -q '"success":true'; then
        local ingested
        ingested=$(echo "$resp" | grep -o '"logs_ingested":[0-9]*' | cut -d: -f2)
        echo -e "[$(date '+%H:%M:%S')] ${GREEN}Sent $count logs -> $ingested ingested${NC}"
        return 0
    else
        echo -e "[$(date '+%H:%M:%S')] ${RED}Send failed: $resp${NC}"
        return 1
    fi
}

send_heartbeat() {
    local endpoint="$1" key="$2"
    curl -s -X POST "$endpoint/agent-gateway/heartbeat" \
        -H "Content-Type: application/json" \
        -H "X-Agent-Key: $key" \
        -d "{\"hostname\":\"$(hostname)\",\"status\":\"active\",\"ip_address\":\"$(hostname -I 2>/dev/null | awk '{print $1}')\",\"agent_version\":\"$AGENT_VERSION\",\"capabilities\":[\"collector\"]}" \
        --max-time 10 &>/dev/null || true
}

# ========== Commands ==========
cmd_configure() {
    echo ""
    echo -e "${CYAN}SOCMind Collector Setup${NC}"
    echo -e "${CYAN}========================${NC}"
    echo -e "${YELLOW}Role: LOG COLLECTOR ONLY (no execution capabilities)${NC}"
    echo ""
    read -rp "API Key: " api_key
    read -rp "API Endpoint (e.g. https://xxxx.supabase.co/functions/v1): " api_endpoint

    # Verify connectivity
    local test_resp
    test_resp=$(curl -s -X POST "$api_endpoint/agent-gateway/heartbeat" \
        -H "Content-Type: application/json" \
        -H "X-Agent-Key: $api_key" \
        -d '{"hostname":"setup-test","status":"active"}' \
        --max-time 15 2>&1)

    if echo "$test_resp" | grep -qE '"success"|"error"'; then
        echo -e "${GREEN}[OK] Endpoint reachable${NC}"
    else
        echo -e "${YELLOW}[WARN] Could not verify endpoint. Saving anyway.${NC}"
    fi

    write_config "$api_key" "$api_endpoint"
    echo ""
    echo -e "${CYAN}Done. Run: ./socmind-collector-linux.sh start${NC}"
}

cmd_start() {
    local test_mode="$1"
    local api_key
    local api_endpoint
    api_key=$(read_config "api_key")
    api_endpoint=$(read_config "api_endpoint")

    if [ -z "$api_key" ] || [ -z "$api_endpoint" ]; then
        echo -e "${RED}[ERR] Not configured. Run 'configure' first.${NC}"
        exit 1
    fi

    local log_interval=30
    local heartbeat_interval=60
    [ "$test_mode" = "test" ] && log_interval=5

    echo ""
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}  SOCMind COLLECTOR v${AGENT_VERSION}${NC}"
    echo -e "  Host:     $(hostname)"
    echo -e "${GREEN}  Role:     LOG COLLECTOR ONLY${NC}"
    echo -e "  Endpoint: $api_endpoint"
    echo -e "  Interval: ${log_interval}s"
    echo -e "${CYAN}============================================${NC}"
    echo ""

    if [ "$test_mode" = "test" ]; then
        echo -e "${YELLOW}[TEST] Single collection cycle...${NC}"
        local logs
        logs=$(collect_logs 50)
        send_logs "$api_endpoint" "$api_key" "$logs"
        echo -e "${GREEN}[TEST] Done.${NC}"
        exit 0
    fi

    local last_log_time=0
    local last_heartbeat_time=0

    while true; do
        local now
        now=$(date +%s)

        if [ $((now - last_log_time)) -ge $log_interval ]; then
            local logs
            logs=$(collect_logs 200)
            send_logs "$api_endpoint" "$api_key" "$logs"
            last_log_time=$now
        fi

        if [ $((now - last_heartbeat_time)) -ge $heartbeat_interval ]; then
            send_heartbeat "$api_endpoint" "$api_key"
            last_heartbeat_time=$now
        fi

        sleep 5
    done
}

cmd_status() {
    echo ""
    echo -e "${CYAN}SOCMind Collector v${AGENT_VERSION}${NC}"
    echo -e "${CYAN}================================${NC}"
    if [ ! -f "$CONFIG_FILE" ]; then
        echo -e "${RED}Status: NOT CONFIGURED${NC}"
    else
        echo -e "Endpoint : $(read_config api_endpoint)"
        echo -e "API Key  : $(read_config api_key | cut -c1-12)..."
        echo -e "${YELLOW}Role     : COLLECTOR ONLY (no execution)${NC}"
        echo -e "Host     : $(hostname)"
    fi
    echo ""
}

show_help() {
    echo ""
    echo -e "${CYAN}SOCMind Collector Agent v${AGENT_VERSION}${NC}"
    echo -e "${YELLOW}Role: LOG COLLECTOR ONLY — no SOAR execution${NC}"
    echo ""
    echo "Commands:"
    echo "  configure   First-time setup (API key + endpoint)"
    echo "  start       Start continuous log collection"
    echo "  test        Run one collection cycle and exit"
    echo "  status      Show configuration"
    echo ""
    echo -e "${GREEN}Deploy on EVERY endpoint to collect logs.${NC}"
    echo -e "${GREEN}Use socmind-executor.py on ONE secure host for SOAR actions.${NC}"
    echo ""
}

# ========== Entry Point ==========
case "${1:-help}" in
    configure)  cmd_configure ;;
    start)      cmd_start ;;
    test)       cmd_start test ;;
    status)     cmd_status ;;
    *)          show_help ;;
esac
