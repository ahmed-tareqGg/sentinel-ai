#!/bin/bash
# SOCMind Agent for Linux
# Lightweight log collection and forwarding agent

set -e

AGENT_VERSION="1.0.0"
CONFIG_FILE="/etc/socmind/agent.conf"
LOG_FILE="/var/log/socmind-agent.log"
PID_FILE="/var/run/socmind-agent.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[SOCMind]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}[SOCMind ERROR]${NC} $1" >&2
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[SOCMind WARN]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN: $1" >> "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        exit 1
    fi
}

# Load configuration
load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
    else
        error "Configuration file not found: $CONFIG_FILE"
        error "Run 'socmind-agent configure' first"
        exit 1
    fi
}

# Configure the agent
configure() {
    log "Configuring SOCMind Agent..."
    
    mkdir -p /etc/socmind
    mkdir -p /var/log
    
    read -p "Enter SOCMind API Endpoint [https://kglmzurhiiuhxmzykkqv.supabase.co/functions/v1/agent-gateway]: " API_ENDPOINT
    API_ENDPOINT=${API_ENDPOINT:-"https://kglmzurhiiuhxmzykkqv.supabase.co/functions/v1/agent-gateway"}
    
    read -p "Enter Agent API Key: " API_KEY
    if [[ -z "$API_KEY" ]]; then
        error "API Key is required"
        exit 1
    fi
    
    read -p "Enter Log Types to collect (comma-separated) [auth,system,security]: " LOG_TYPES
    LOG_TYPES=${LOG_TYPES:-"auth,system,security"}
    
    read -p "Enter collection interval in seconds [60]: " INTERVAL
    INTERVAL=${INTERVAL:-60}
    
    cat > "$CONFIG_FILE" << EOF
# SOCMind Agent Configuration
SOCMIND_API_ENDPOINT="$API_ENDPOINT"
SOCMIND_API_KEY="$API_KEY"
SOCMIND_LOG_TYPES="$LOG_TYPES"
SOCMIND_INTERVAL="$INTERVAL"
SOCMIND_HOSTNAME="$(hostname)"
EOF
    
    chmod 600 "$CONFIG_FILE"
    log "Configuration saved to $CONFIG_FILE"
}

# Send heartbeat
send_heartbeat() {
    local status="${1:-active}"
    local error_msg="$2"
    
    local payload="{\"hostname\": \"$SOCMIND_HOSTNAME\", \"status\": \"$status\""
    if [[ -n "$error_msg" ]]; then
        payload="$payload, \"error_message\": \"$error_msg\""
    fi
    payload="$payload}"
    
    curl -s -X POST "$SOCMIND_API_ENDPOINT/heartbeat" \
        -H "X-Agent-Key: $SOCMIND_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$payload" > /dev/null 2>&1
}

# Collect auth logs
collect_auth_logs() {
    local logs=()
    local since=$(date -d "1 minute ago" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -v-1M '+%Y-%m-%d %H:%M:%S')
    
    # Parse /var/log/auth.log or /var/log/secure
    local auth_log="/var/log/auth.log"
    [[ -f "/var/log/secure" ]] && auth_log="/var/log/secure"
    
    if [[ -f "$auth_log" ]]; then
        while IFS= read -r line; do
            local severity=2
            local event_type="Auth Event"
            
            if echo "$line" | grep -qi "failed"; then
                severity=4
                event_type="Failed Authentication"
            elif echo "$line" | grep -qi "accepted"; then
                event_type="Successful Authentication"
            elif echo "$line" | grep -qi "invalid"; then
                severity=4
                event_type="Invalid User"
            elif echo "$line" | grep -qi "sudo"; then
                severity=3
                event_type="Privilege Escalation"
            fi
            
            # Extract source IP if present
            local src_ip=$(echo "$line" | grep -oP '(?:from |rhost=)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})' | head -1 | grep -oP '\d+\.\d+\.\d+\.\d+' || echo "")
            
            logs+=("{\"log_type\": \"auth\", \"timestamp\": \"$(date -Iseconds)\", \"message\": \"$(echo "$line" | sed 's/"/\\"/g')\", \"severity\": $severity, \"source_ip\": \"${src_ip:-$SOCMIND_HOSTNAME}\", \"raw_log\": {\"source\": \"$auth_log\"}}")
        done < <(tail -n 100 "$auth_log" | grep -i -E "(ssh|login|auth|sudo|su:|failed|accepted)" | tail -n 20)
    fi
    
    echo "[$(IFS=,; echo "${logs[*]}")]"
}

# Collect system logs
collect_system_logs() {
    local logs=()
    
    # Check journalctl or /var/log/syslog
    if command -v journalctl &> /dev/null; then
        while IFS= read -r line; do
            local severity=2
            local event_type="System Event"
            
            if echo "$line" | grep -qi "error"; then
                severity=4
                event_type="System Error"
            elif echo "$line" | grep -qi "warning"; then
                severity=3
                event_type="System Warning"
            elif echo "$line" | grep -qi "critical\|panic"; then
                severity=5
                event_type="Critical System Event"
            fi
            
            logs+=("{\"log_type\": \"system\", \"timestamp\": \"$(date -Iseconds)\", \"message\": \"$(echo "$line" | sed 's/"/\\"/g')\", \"severity\": $severity, \"source_ip\": \"$SOCMIND_HOSTNAME\", \"raw_log\": {\"source\": \"journalctl\"}}")
        done < <(journalctl --since "1 minute ago" --no-pager -q 2>/dev/null | tail -n 20)
    elif [[ -f "/var/log/syslog" ]]; then
        while IFS= read -r line; do
            local severity=2
            logs+=("{\"log_type\": \"system\", \"timestamp\": \"$(date -Iseconds)\", \"message\": \"$(echo "$line" | sed 's/"/\\"/g')\", \"severity\": $severity, \"source_ip\": \"$SOCMIND_HOSTNAME\", \"raw_log\": {\"source\": \"/var/log/syslog\"}}")
        done < <(tail -n 20 /var/log/syslog)
    fi
    
    echo "[$(IFS=,; echo "${logs[*]}")]"
}

# Collect security logs (audit logs)
collect_security_logs() {
    local logs=()
    
    # Check audit.log
    if [[ -f "/var/log/audit/audit.log" ]]; then
        while IFS= read -r line; do
            local severity=3
            local event_type="Security Event"
            
            if echo "$line" | grep -qi "type=EXECVE\|type=SYSCALL"; then
                event_type="Process Execution"
            elif echo "$line" | grep -qi "type=USER_AUTH"; then
                severity=4
                event_type="User Authentication"
            elif echo "$line" | grep -qi "type=AVC"; then
                severity=4
                event_type="SELinux Denial"
            fi
            
            logs+=("{\"log_type\": \"security\", \"timestamp\": \"$(date -Iseconds)\", \"message\": \"$(echo "$line" | sed 's/"/\\"/g')\", \"severity\": $severity, \"source_ip\": \"$SOCMIND_HOSTNAME\", \"raw_log\": {\"source\": \"/var/log/audit/audit.log\"}}")
        done < <(tail -n 50 /var/log/audit/audit.log | tail -n 10)
    fi
    
    # Check for firewall logs
    if command -v iptables &> /dev/null; then
        local fw_log=$(dmesg 2>/dev/null | grep -i "iptables\|nf_" | tail -n 5)
        while IFS= read -r line; do
            if [[ -n "$line" ]]; then
                logs+=("{\"log_type\": \"security\", \"timestamp\": \"$(date -Iseconds)\", \"message\": \"Firewall: $(echo "$line" | sed 's/"/\\"/g')\", \"severity\": 3, \"source_ip\": \"$SOCMIND_HOSTNAME\", \"raw_log\": {\"source\": \"dmesg\"}}")
            fi
        done <<< "$fw_log"
    fi
    
    echo "[$(IFS=,; echo "${logs[*]}")]"
}

# Send logs to SOCMind
send_logs() {
    local logs="$1"
    
    if [[ "$logs" == "[]" ]] || [[ -z "$logs" ]]; then
        return 0
    fi
    
    local response=$(curl -s -w "\n%{http_code}" -X POST "$SOCMIND_API_ENDPOINT/ingest" \
        -H "X-Agent-Key: $SOCMIND_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"logs\": $logs}")
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n-1)
    
    if [[ "$http_code" == "200" ]]; then
        log "Successfully sent logs"
    else
        error "Failed to send logs (HTTP $http_code): $body"
        return 1
    fi
}

# Main collection loop
run() {
    load_config
    
    log "SOCMind Agent v$AGENT_VERSION starting..."
    log "Hostname: $SOCMIND_HOSTNAME"
    log "API Endpoint: $SOCMIND_API_ENDPOINT"
    log "Log Types: $SOCMIND_LOG_TYPES"
    log "Interval: ${SOCMIND_INTERVAL}s"
    
    # Write PID
    echo $$ > "$PID_FILE"
    
    # Send initial heartbeat
    send_heartbeat "active"
    
    while true; do
        local all_logs="["
        local first=true
        
        IFS=',' read -ra TYPES <<< "$SOCMIND_LOG_TYPES"
        for log_type in "${TYPES[@]}"; do
            log_type=$(echo "$log_type" | tr -d ' ')
            
            case "$log_type" in
                auth)
                    logs=$(collect_auth_logs)
                    ;;
                system)
                    logs=$(collect_system_logs)
                    ;;
                security)
                    logs=$(collect_security_logs)
                    ;;
                *)
                    warn "Unknown log type: $log_type"
                    continue
                    ;;
            esac
            
            # Append logs (remove outer brackets)
            logs_inner=$(echo "$logs" | sed 's/^\[//;s/\]$//')
            if [[ -n "$logs_inner" ]] && [[ "$logs_inner" != "[]" ]]; then
                if [[ "$first" == true ]]; then
                    all_logs="$all_logs$logs_inner"
                    first=false
                else
                    all_logs="$all_logs,$logs_inner"
                fi
            fi
        done
        
        all_logs="$all_logs]"
        
        # Send collected logs
        if [[ "$all_logs" != "[]" ]]; then
            send_logs "$all_logs" || send_heartbeat "error" "Failed to send logs"
        fi
        
        # Send heartbeat
        send_heartbeat "active"
        
        sleep "$SOCMIND_INTERVAL"
    done
}

# Stop the agent
stop() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log "Stopping SOCMind Agent (PID: $pid)..."
            kill "$pid"
            rm -f "$PID_FILE"
            log "Agent stopped"
        else
            warn "Process not running"
            rm -f "$PID_FILE"
        fi
    else
        warn "PID file not found"
    fi
}

# Check status
status() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log "SOCMind Agent is running (PID: $pid)"
            return 0
        else
            warn "SOCMind Agent is not running (stale PID file)"
            return 1
        fi
    else
        warn "SOCMind Agent is not running"
        return 1
    fi
}

# Install as systemd service
install_service() {
    check_root
    
    local script_path=$(readlink -f "$0")
    
    cat > /etc/systemd/system/socmind-agent.service << EOF
[Unit]
Description=SOCMind Security Agent
After=network.target

[Service]
Type=simple
ExecStart=$script_path run
ExecStop=$script_path stop
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable socmind-agent
    log "Installed as systemd service. Run 'systemctl start socmind-agent' to start."
}

# Show help
help() {
    echo "SOCMind Agent v$AGENT_VERSION"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  configure    Configure the agent with API credentials"
    echo "  run          Start the agent in foreground"
    echo "  stop         Stop a running agent"
    echo "  status       Check if agent is running"
    echo "  install      Install as systemd service"
    echo "  help         Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 configure"
    echo "  $0 run"
}

# Main entry point
case "${1:-help}" in
    configure)
        check_root
        configure
        ;;
    run)
        check_root
        run
        ;;
    stop)
        check_root
        stop
        ;;
    status)
        status
        ;;
    install)
        install_service
        ;;
    help|--help|-h)
        help
        ;;
    *)
        error "Unknown command: $1"
        help
        exit 1
        ;;
esac