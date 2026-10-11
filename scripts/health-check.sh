#!/bin/bash

# CoFounderBay Health Check Script
# This script checks the health of all system components

set -e

echo "🏥 CoFounderBay Health Check"
echo "============================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
    esac
}

# Function to check if service is running
check_service() {
    local service=$1
    local port=$2
    local url=$3
    
    if [ -n "$url" ]; then
        if curl -s -f "$url" > /dev/null 2>&1; then
            print_status "OK" "$service is running"
            return 0
        else
            print_status "ERROR" "$service is not responding"
            return 1
        fi
    elif [ -n "$port" ]; then
        if nc -z localhost "$port" 2>/dev/null; then
            print_status "OK" "$service is running on port $port"
            return 0
        else
            print_status "ERROR" "$service is not running on port $port"
            return 1
        fi
    else
        print_status "ERROR" "Cannot check $service - no port or URL specified"
        return 1
    fi
}

# Function to check PM2 processes
check_pm2() {
    print_status "INFO" "Checking PM2 processes..."
    
    if ! command -v pm2 &> /dev/null; then
        print_status "ERROR" "PM2 is not installed"
        return 1
    fi
    
    local processes=$(pm2 list | grep -E "(cofounderbay|online)" | wc -l)
    if [ "$processes" -gt 0 ]; then
        print_status "OK" "PM2 processes running ($processes processes)"
        pm2 list
        return 0
    else
        print_status "ERROR" "No PM2 processes running"
        return 1
    fi
}

# Function to check database connection
check_database() {
    print_status "INFO" "Checking database connection..."
    
    # Check PostgreSQL
    if command -v psql &> /dev/null; then
        if PGPASSWORD="${DATABASE_PASSWORD:-}" psql -h "${DATABASE_HOST:-localhost}" -U "${DATABASE_USER:-postgres}" -p "${DATABASE_PORT:-5432}" -d "${DATABASE_NAME:-cofounderbay}" -c "SELECT 1;" &> /dev/null; then
            print_status "OK" "PostgreSQL database is accessible"
        else
            print_status "ERROR" "Cannot connect to PostgreSQL database"
            return 1
        fi
    else
        print_status "WARNING" "psql not available, skipping database check"
    fi
}

# Function to check Redis connection
check_redis() {
    print_status "INFO" "Checking Redis connection..."
    
    if command -v redis-cli &> /dev/null; then
        if redis-cli -h "${REDIS_HOST:-localhost}" -p "${REDIS_PORT:-6379}" ping | grep -q "PONG"; then
            print_status "OK" "Redis server is responding"
        else
            print_status "ERROR" "Cannot connect to Redis server"
            return 1
        fi
    else
        print_status "WARNING" "redis-cli not available, skipping Redis check"
    fi
}

# Function to check API endpoints
check_api_endpoints() {
    print_status "INFO" "Checking API endpoints..."
    
    local base_url="${API_BASE_URL:-http://localhost:3001}"
    local endpoints=(
        "/api/v1/health"
        "/api/v1/health/readiness"
        "/api/v1/health/liveness"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -s -f "$base_url$endpoint" > /dev/null 2>&1; then
            print_status "OK" "API endpoint $endpoint is accessible"
        else
            print_status "ERROR" "API endpoint $endpoint is not accessible"
        fi
    done
}

# Function to check disk space
check_disk_space() {
    print_status "INFO" "Checking disk space..."
    
    local usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$usage" -lt 80 ]; then
        print_status "OK" "Disk usage is ${usage}%"
    elif [ "$usage" -lt 90 ]; then
        print_status "WARNING" "Disk usage is ${usage}% (getting high)"
    else
        print_status "ERROR" "Disk usage is ${usage}% (critical)"
    fi
}

# Function to check memory usage
check_memory() {
    print_status "INFO" "Checking memory usage..."
    
    if command -v free &> /dev/null; then
        local usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
        if [ "$usage" -lt 80 ]; then
            print_status "OK" "Memory usage is ${usage}%"
        elif [ "$usage" -lt 90 ]; then
            print_status "WARNING" "Memory usage is ${usage}% (getting high)"
        else
            print_status "ERROR" "Memory usage is ${usage}% (critical)"
        fi
    else
        print_status "WARNING" "Cannot check memory usage (free command not available)"
    fi
}

# Function to check SSL certificates
check_ssl() {
    print_status "INFO" "Checking SSL certificates..."
    
    local domain="${DOMAIN:-cofounderbay.com}"
    if [ -n "$domain" ] && [ "$domain" != "localhost" ]; then
        if openssl s_client -connect "$domain:443" -servername "$domain" < /dev/null 2>/dev/null | openssl x509 -noout -dates 2>/dev/null; then
            print_status "OK" "SSL certificate for $domain is valid"
        else
            print_status "WARNING" "Cannot verify SSL certificate for $domain"
        fi
    else
        print_status "INFO" "Skipping SSL check (localhost or no domain specified)"
    fi
}

# Function to check log files
check_logs() {
    print_status "INFO" "Checking log files..."
    
    local log_dirs=("logs" "/var/log/cofounderbay")
    local found_logs=false
    
    for dir in "${log_dirs[@]}"; do
        if [ -d "$dir" ]; then
            local log_count=$(find "$dir" -name "*.log" -type f | wc -l)
            if [ "$log_count" -gt 0 ]; then
                print_status "OK" "Found $log_count log files in $dir"
                found_logs=true
                
                # Check for recent errors
                local error_count=$(find "$dir" -name "*.log" -type f -mtime -1 -exec grep -l "ERROR\|FATAL" {} \; | wc -l)
                if [ "$error_count" -gt 0 ]; then
                    print_status "WARNING" "Found $error_count log files with recent errors"
                fi
            fi
        fi
    done
    
    if [ "$found_logs" = false ]; then
        print_status "WARNING" "No log files found"
    fi
}

# Function to generate health report
generate_report() {
    print_status "INFO" "Generating health report..."
    
    local report_file="health-report-$(date +%Y%m%d-%H%M%S).txt"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    {
        echo "CoFounderBay Health Report"
        echo "========================="
        echo "Generated: $timestamp"
        echo ""
        echo "System Information:"
        echo "- Hostname: $(hostname)"
        echo "- OS: $(uname -s -r)"
        echo "- Uptime: $(uptime -p 2>/dev/null || uptime)"
        echo ""
        echo "Service Status:"
        pm2 list 2>/dev/null || echo "PM2 not available"
        echo ""
        echo "Disk Usage:"
        df -h
        echo ""
        echo "Memory Usage:"
        free -h 2>/dev/null || echo "Memory info not available"
        echo ""
        echo "Recent Errors (last 50 lines):"
        find logs -name "*.log" -type f -mtime -1 -exec tail -n 20 {} \; 2>/dev/null | grep -E "ERROR|FATAL" | tail -n 50 || echo "No recent errors found"
    } > "$report_file"
    
    print_status "OK" "Health report saved to $report_file"
}

# Main health check execution
main() {
    local overall_status=0
    
    echo "Starting comprehensive health check..."
    echo ""
    
    # Check PM2 processes
    check_pm2 || overall_status=1
    echo ""
    
    # Check services
    check_service "API Server" "3001" "http://localhost:3001/api/v1/health" || overall_status=1
    check_service "Web Server" "3000" "http://localhost:3000" || overall_status=1
    check_service "PostgreSQL" "5432" "" || overall_status=1
    check_service "Redis" "6379" "" || overall_status=1
    check_service "Meilisearch" "7700" "" || overall_status=1
    echo ""
    
    # Check system resources
    check_disk_space || overall_status=1
    check_memory || overall_status=1
    echo ""
    
    # Check application-specific items
    check_database || overall_status=1
    check_redis || overall_status=1
    check_api_endpoints || overall_status=1
    check_ssl
    check_logs
    echo ""
    
    # Generate report
    generate_report
    
    echo ""
    echo "============================"
    if [ $overall_status -eq 0 ]; then
        print_status "OK" "All critical systems are healthy"
        exit 0
    else
        print_status "ERROR" "Some systems require attention"
        exit 1
    fi
}

# Run main function
main "$@"
