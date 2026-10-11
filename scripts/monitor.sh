#!/bin/bash

# CoFounderBay Monitoring Script
# This script provides real-time monitoring of system resources and application metrics

set -e

echo "📊 CoFounderBay System Monitor"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
INTERVAL=${INTERVAL:-5}
LOG_FILE="monitoring-$(date +%Y%m%d).log"
ALERT_THRESHOLD_CPU=${ALERT_THRESHOLD_CPU:-80}
ALERT_THRESHOLD_MEMORY=${ALERT_THRESHOLD_MEMORY:-85}
ALERT_THRESHOLD_DISK=${ALERT_THRESHOLD_DISK:-90}

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "OK")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
        "METRIC")
            echo -e "${CYAN}📈 $message${NC}"
            ;;
    esac
}

# Function to log to file
log_message() {
    local message=$1
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $message" >> "$LOG_FILE"
}

# Function to get CPU usage
get_cpu_usage() {
    if command -v top &> /dev/null; then
        top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//'
    elif command -v vmstat &> /dev/null; then
        vmstat 1 2 | tail -1 | awk '{print 100 - $15}'
    else
        echo "N/A"
    fi
}

# Function to get memory usage
get_memory_usage() {
    if command -v free &> /dev/null; then
        free | awk 'NR==2{printf "%.1f", $3*100/$2}'
    else
        echo "N/A"
    fi
}

# Function to get disk usage
get_disk_usage() {
    df / | awk 'NR==2 {print $5}' | sed 's/%//'
}

# Function to get load average
get_load_average() {
    if command -v uptime &> /dev/null; then
        uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//'
    else
        echo "N/A"
    fi
}

# Function to check PM2 processes
check_pm2_processes() {
    if command -v pm2 &> /dev/null; then
        local api_status=$(pm2 jlist | jq -r '.[] | select(.name=="cofounderbay-api") | .pm2_env.status' 2>/dev/null || echo "unknown")
        local web_status=$(pm2 jlist | jq -r '.[] | select(.name=="cofounderbay-web") | .pm2_env.status' 2>/dev/null || echo "unknown")
        
        echo "API: $api_status, Web: $web_status"
    else
        echo "PM2 not available"
    fi
}

# Function to get API response time
get_api_response_time() {
    local start_time=$(date +%s%N)
    if curl -s -f "http://localhost:3001/api/v1/health" > /dev/null 2>&1; then
        local end_time=$(date +%s%N)
        local response_time=$(( (end_time - start_time) / 1000000 ))
        echo "${response_time}ms"
    else
        echo "Failed"
    fi
}

# Function to get database connections
get_db_connections() {
    if command -v psql &> /dev/null; then
        PGPASSWORD="${DATABASE_PASSWORD:-}" psql -h "${DATABASE_HOST:-localhost}" -U "${DATABASE_USER:-postgres}" -p "${DATABASE_PORT:-5432}" -d "${DATABASE_NAME:-cofounderbay}" -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" -t 2>/dev/null | tr -d ' ' || echo "N/A"
    else
        echo "N/A"
    fi
}

# Function to get Redis memory usage
get_redis_memory() {
    if command -v redis-cli &> /dev/null; then
        redis-cli -h "${REDIS_HOST:-localhost}" -p "${REDIS_PORT:-6379}" info memory | grep "used_memory_human:" | cut -d: -f2 | tr -d '\r' || echo "N/A"
    else
        echo "N/A"
    fi
}

# Function to check application logs for errors
check_app_errors() {
    local error_count=0
    local log_dirs=("logs" "/var/log/cofounderbay")
    
    for dir in "${log_dirs[@]}"; do
        if [ -d "$dir" ]; then
            local count=$(find "$dir" -name "*.log" -type f -mmin -5 -exec grep -c "ERROR\|FATAL" {} \; 2>/dev/null | awk '{sum += $1} END {print sum}')
            error_count=$((error_count + count))
        fi
    done
    
    echo $error_count
}

# Function to display system metrics
display_metrics() {
    clear
    echo "📊 CoFounderBay System Monitor"
    echo "=============================="
    echo "Last updated: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Interval: ${INTERVAL}s | Log: $LOG_FILE"
    echo ""
    
    # System Resources
    echo "🖥️  SYSTEM RESOURCES"
    echo "-------------------"
    
    local cpu_usage=$(get_cpu_usage)
    local memory_usage=$(get_memory_usage)
    local disk_usage=$(get_disk_usage)
    local load_avg=$(get_load_average)
    
    # CPU
    if [ "$cpu_usage" != "N/A" ]; then
        if (( $(echo "$cpu_usage > $ALERT_THRESHOLD_CPU" | bc -l) )); then
            print_status "ERROR" "CPU Usage: ${cpu_usage}% (Threshold: ${ALERT_THRESHOLD_CPU}%)"
        elif (( $(echo "$cpu_usage > $((ALERT_THRESHOLD_CPU - 10))" | bc -l) )); then
            print_status "WARNING" "CPU Usage: ${cpu_usage}%"
        else
            print_status "OK" "CPU Usage: ${cpu_usage}%"
        fi
    else
        print_status "WARNING" "CPU Usage: N/A"
    fi
    
    # Memory
    if [ "$memory_usage" != "N/A" ]; then
        if (( $(echo "$memory_usage > $ALERT_THRESHOLD_MEMORY" | bc -l) )); then
            print_status "ERROR" "Memory Usage: ${memory_usage}% (Threshold: ${ALERT_THRESHOLD_MEMORY}%)"
        elif (( $(echo "$memory_usage > $((ALERT_THRESHOLD_MEMORY - 10))" | bc -l) )); then
            print_status "WARNING" "Memory Usage: ${memory_usage}%"
        else
            print_status "OK" "Memory Usage: ${memory_usage}%"
        fi
    else
        print_status "WARNING" "Memory Usage: N/A"
    fi
    
    # Disk
    if [ "$disk_usage" != "N/A" ]; then
        if [ "$disk_usage" -gt "$ALERT_THRESHOLD_DISK" ]; then
            print_status "ERROR" "Disk Usage: ${disk_usage}% (Threshold: ${ALERT_THRESHOLD_DISK}%)"
        elif [ "$disk_usage" -gt "$((ALERT_THRESHOLD_DISK - 10))" ]; then
            print_status "WARNING" "Disk Usage: ${disk_usage}%"
        else
            print_status "OK" "Disk Usage: ${disk_usage}%"
        fi
    else
        print_status "WARNING" "Disk Usage: N/A"
    fi
    
    # Load Average
    if [ "$load_avg" != "N/A" ]; then
        print_status "METRIC" "Load Average: $load_avg"
    else
        print_status "WARNING" "Load Average: N/A"
    fi
    
    echo ""
    
    # Application Status
    echo "🚀 APPLICATION STATUS"
    echo "--------------------"
    
    local pm2_status=$(check_pm2_processes)
    print_status "INFO" "PM2 Processes: $pm2_status"
    
    local api_response=$(get_api_response_time)
    if [ "$api_response" != "Failed" ]; then
        if [ "${api_response%ms}" -gt 1000 ]; then
            print_status "WARNING" "API Response Time: $api_response"
        else
            print_status "OK" "API Response Time: $api_response"
        fi
    else
        print_status "ERROR" "API Response Time: Failed"
    fi
    
    local db_connections=$(get_db_connections)
    print_status "INFO" "Active DB Connections: $db_connections"
    
    local redis_memory=$(get_redis_memory)
    print_status "INFO" "Redis Memory Usage: $redis_memory"
    
    local error_count=$(check_app_errors)
    if [ "$error_count" -gt 0 ]; then
        print_status "ERROR" "Recent Errors (5min): $error_count"
    else
        print_status "OK" "Recent Errors (5min): $error_count"
    fi
    
    echo ""
    
    # Recent Activity
    echo "📋 RECENT ACTIVITY"
    echo "-----------------"
    
    # Show recent PM2 logs
    if command -v pm2 &> /dev/null; then
        echo "Recent PM2 logs:"
        pm2 logs --lines 3 --nostream 2>/dev/null | tail -n 6 || echo "No logs available"
    fi
    
    echo ""
    echo "Press Ctrl+C to stop monitoring"
}

# Function to run in background mode
run_background() {
    print_status "INFO" "Starting background monitoring (interval: ${INTERVAL}s)"
    print_status "INFO" "Logging to: $LOG_FILE"
    
    while true; do
        local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
        local cpu_usage=$(get_cpu_usage)
        local memory_usage=$(get_memory_usage)
        local disk_usage=$(get_disk_usage)
        local api_response=$(get_api_response_time)
        local error_count=$(check_app_errors)
        
        log_message "CPU: ${cpu_usage}%, Memory: ${memory_usage}%, Disk: ${disk_usage}%, API: ${api_response}, Errors: ${error_count}"
        
        # Check for alerts
        if [ "$cpu_usage" != "N/A" ] && (( $(echo "$cpu_usage > $ALERT_THRESHOLD_CPU" | bc -l) )); then
            log_message "ALERT: High CPU usage: ${cpu_usage}%"
        fi
        
        if [ "$memory_usage" != "N/A" ] && (( $(echo "$memory_usage > $ALERT_THRESHOLD_MEMORY" | bc -l) )); then
            log_message "ALERT: High memory usage: ${memory_usage}%"
        fi
        
        if [ "$disk_usage" != "N/A" ] && [ "$disk_usage" -gt "$ALERT_THRESHOLD_DISK" ]; then
            log_message "ALERT: High disk usage: ${disk_usage}%"
        fi
        
        if [ "$api_response" = "Failed" ]; then
            log_message "ALERT: API not responding"
        fi
        
        if [ "$error_count" -gt 0 ]; then
            log_message "ALERT: $error_count errors detected"
        fi
        
        sleep "$INTERVAL"
    done
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -i, --interval SECONDS    Set monitoring interval (default: 5)"
    echo "  -b, --background         Run in background mode"
    echo "  -l, --log FILE           Set log file (default: monitoring-YYYYMMDD.log)"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  ALERT_THRESHOLD_CPU      CPU alert threshold (default: 80)"
    echo "  ALERT_THRESHOLD_MEMORY   Memory alert threshold (default: 85)"
    echo "  ALERT_THRESHOLD_DISK     Disk alert threshold (default: 90)"
    echo ""
    echo "Examples:"
    echo "  $0                       # Interactive mode"
    echo "  $0 -i 10                 # 10-second interval"
    echo "  $0 -b                    # Background mode"
    echo "  $0 -l custom.log         # Custom log file"
}

# Parse command line arguments
BACKGROUND=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--interval)
            INTERVAL="$2"
            shift 2
            ;;
        -b|--background)
            BACKGROUND=true
            shift
            ;;
        -l|--log)
            LOG_FILE="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Check dependencies
if ! command -v bc &> /dev/null; then
    print_status "WARNING" "bc not available, some calculations may not work"
fi

if ! command -v jq &> /dev/null; then
    print_status "WARNING" "jq not available, PM2 JSON parsing may not work"
fi

# Main execution
if [ "$BACKGROUND" = true ]; then
    run_background
else
    # Handle Ctrl+C gracefully
    trap 'echo -e "\n${BLUE}Monitoring stopped${NC}"; exit 0' INT
    
    while true; do
        display_metrics
        sleep "$INTERVAL"
    done
fi
