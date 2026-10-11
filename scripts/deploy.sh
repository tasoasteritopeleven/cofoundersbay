#!/bin/bash

# CoFounderBay Deployment Script
# This script handles zero-downtime deployment with health checks and rollback

set -e -o pipefail

echo "🚀 CoFounderBay Deployment Script"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${ENVIRONMENT:-production}
APP_DIR=${APP_DIR:-"/var/www/cofounderbay"}
BACKUP_DIR=${BACKUP_DIR:-"/var/backups/cofounderbay"}
LOG_FILE="/var/log/cofounderbay/deploy.log"
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-300}
ROLLBACK_ON_FAILURE=${ROLLBACK_ON_FAILURE:-true}

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

# Function to log to file
log_message() {
    local message=$1
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $message" >> "$LOG_FILE"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "INFO" "Checking deployment prerequisites..."
    
    local errors=0
    
    # Check required commands
    local required_commands=("git" "pnpm" "pm2" "node" "curl")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            print_status "ERROR" "Required command not found: $cmd"
            errors=$((errors + 1))
        fi
    done
    
    # Check Node.js version
    if command -v node &> /dev/null; then
        local node_version=$(node --version | cut -d'v' -f2)
        if ! node "$APP_DIR/scripts/ensure-supported-node.cjs" deployment; then
            print_status "ERROR" "Node.js version $node_version is not supported by this workspace"
            errors=$((errors + 1))
        else
            print_status "OK" "Node.js version: $node_version"
        fi
    fi
    
    # Check PM2
    if command -v pm2 &> /dev/null; then
        print_status "OK" "PM2 version: $(pm2 --version)"
    else
        print_status "ERROR" "PM2 is required for deployment"
        errors=$((errors + 1))
    fi
    
    # Check directories
    if [ ! -d "$APP_DIR" ]; then
        print_status "ERROR" "Application directory not found: $APP_DIR"
        errors=$((errors + 1))
    fi
    
    if [ "$errors" -gt 0 ]; then
        print_status "ERROR" "Prerequisites check failed with $errors errors"
        exit 1
    fi
    
    print_status "OK" "All prerequisites satisfied"
}

# Function to create backup before deployment
create_backup() {
    print_status "INFO" "Creating pre-deployment backup..."
    
    local backup_name="pre_deploy_$(date +%Y%m%d_%H%M%S)"
    
    if [ -f "$BACKUP_DIR/backup.sh" ]; then
        "$BACKUP_DIR/backup.sh" -d "$BACKUP_DIR" backup
        print_status "OK" "Pre-deployment backup created"
    else
        print_status "WARNING" "Backup script not found, skipping backup"
    fi
}

# Function to update code
update_code() {
    print_status "INFO" "Updating application code..."
    
    cd "$APP_DIR"
    
    # Stash any local changes
    if [ -n "$(git status --porcelain)" ]; then
        print_status "ERROR" "Local changes detected; refusing to stash or overwrite operator changes"
        exit 1
    fi
    git rev-parse HEAD > "$(git rev-parse --git-path cfb-previous-deploy)"
    
    # Fetch latest changes
    git fetch origin
    
    # Get current branch
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    local target_branch="main"
    
    if [ "$ENVIRONMENT" = "staging" ]; then
        target_branch="develop"
    fi
    
    print_status "INFO" "Current branch: $current_branch"
    print_status "INFO" "Target branch: $target_branch"
    
    # Switch to target branch
    if [ "$current_branch" != "$target_branch" ]; then
        git checkout "$target_branch"
    fi
    
    # Pull latest changes
    git pull --ff-only origin "$target_branch"
    
    # Get deployment commit
    local deploy_commit=$(git rev-parse HEAD)
    print_status "OK" "Code updated to commit: $deploy_commit"
    
    echo "$deploy_commit" > /tmp/deploy_commit
}

# Function to install dependencies
install_dependencies() {
    print_status "INFO" "Installing dependencies..."
    
    cd "$APP_DIR"
    
    # Install root dependencies
    pnpm install --frozen-lockfile --prod=false
    
    # Install API dependencies
    pnpm --filter @cofounderbay/api exec prisma generate
    
    # Install Web dependencies
    pnpm --filter @cofounderbay/web exec next --version
    
    print_status "OK" "Dependencies installed"
}

# Function to build applications
build_applications() {
    print_status "INFO" "Building applications..."
    
    cd "$APP_DIR"
    
    # Build shared packages
    pnpm --filter @cofounderbay/shared build
    
    # Build API
    pnpm --filter @cofounderbay/api build
    
    # Build Web
    pnpm --filter @cofounderbay/web build
    
    print_status "OK" "Applications built successfully"
}

# Function to run database migrations
run_migrations() {
    print_status "INFO" "Running database migrations..."
    
    cd "$APP_DIR/apps/api"
    
    # Check if there are pending migrations
    pnpm exec prisma migrate deploy
    print_status "OK" "Database migrations checked and applied"
}

# Function to deploy applications
deploy_applications() {
    print_status "INFO" "Deploying applications..."
    
    cd "$APP_DIR"
    
    # Reload PM2 processes
    if pm2 list | grep -q "cofounderbay"; then
        print_status "INFO" "Reloading existing PM2 processes..."
        pm2 reload ecosystem.config.js --env "$ENVIRONMENT"
    else
        print_status "INFO" "Starting new PM2 processes..."
        pm2 start ecosystem.config.js --env "$ENVIRONMENT"
    fi
    
    # Save PM2 configuration
    pm2 save
    
    print_status "OK" "Applications deployed"
}

api_health_check() {
    curl --max-time 5 -fsS "http://localhost:3001/api/health/ready" 2>/dev/null | node -e '
        let input = "";
        process.stdin.on("data", chunk => input += chunk);
        process.stdin.on("end", () => {
            try {
                const response = JSON.parse(input);
                const data = response.data ?? response;
                process.exit(response.success !== false && data.status === "ready" ? 0 : 1);
            } catch { process.exit(1); }
        });'
}

pm2_health_check() {
    pm2 jlist | node -e '
        let input = "";
        process.stdin.on("data", chunk => input += chunk);
        process.stdin.on("end", () => {
            try {
                const processes = JSON.parse(input);
                const names = ["cofounderbay-api", "cofounderbay-web"];
                process.exit(names.every(name => {
                    const instances = processes.filter(item => item.name === name);
                    return instances.length > 0 && instances.every(item => item.pm2_env?.status === "online");
                }) ? 0 : 1);
            } catch { process.exit(1); }
        });'
}

# Function to health check
health_check() {
    print_status "INFO" "Performing health checks..."
    
    local timeout=$HEALTH_CHECK_TIMEOUT
    local interval=10
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        local api_ready=false
        local web_ready=false
        # Check API health
        if api_health_check; then
            api_ready=true
            print_status "OK" "API health check passed"
        else
            print_status "WARNING" "API health check failed, retrying..."
        fi
        
        # Check Web health
        if curl --max-time 5 -fsS "http://localhost:3000" > /dev/null 2>&1; then
            web_ready=true
            print_status "OK" "Web health check passed"
        else
            print_status "WARNING" "Web health check failed, retrying..."
        fi
        
        # Check PM2 processes
        if [ "$api_ready" = true ] && [ "$web_ready" = true ] && pm2_health_check; then
            print_status "OK" "HTTP readiness and all application instances are healthy"
            return 0
        fi
        
        sleep $interval
        elapsed=$((elapsed + interval))
        print_status "INFO" "Health check in progress... (${elapsed}s/${timeout}s)"
    done
    
    print_status "ERROR" "Health check timed out after ${timeout}s"
    return 1
}

# Function to rollback deployment
rollback_deployment() {
    print_status "ERROR" "Initiating deployment rollback..."
    
    cd "$APP_DIR"
    
    # Get previous commit
    local marker
    marker=$(git rev-parse --git-path cfb-previous-deploy)
    local previous_commit=""
    if [ -f "$marker" ]; then
        read -r previous_commit < "$marker"
    fi
    if [ -n "$(git status --porcelain)" ]; then
        print_status "ERROR" "Rollback refused: local changes must be preserved"
        exit 1
    fi
    
    if [[ "$previous_commit" =~ ^[a-f0-9]{40,64}$ ]] && git cat-file -e "${previous_commit}^{commit}"; then
        print_status "INFO" "Rolling back to commit: $previous_commit"
        
        git switch --detach "$previous_commit"
        
        # Rebuild and redeploy
        install_dependencies
        build_applications
        deploy_applications
        
        # Quick health check
        if health_check; then
            print_status "OK" "Rollback completed successfully"
        else
            print_status "ERROR" "Rollback failed - manual intervention required"
            exit 1
        fi
    else
        print_status "ERROR" "Cannot rollback - no previous commit found"
        exit 1
    fi
}

# Function to cleanup
cleanup() {
    print_status "INFO" "Performing post-deployment cleanup..."
    
    cd "$APP_DIR"
    
    # Clean up node_modules in subdirectories
    print_status "INFO" "Preserving dependencies required by running applications"
    
    # Clean up build artifacts
    print_status "INFO" "Preserving the active build and incremental metadata"
    
    # Restart PM2 to ensure clean state
    pm2_health_check || return 1
    
    print_status "OK" "Cleanup completed"
}

# Function to show deployment status
show_status() {
    print_status "INFO" "Deployment status:"
    
    cd "$APP_DIR"
    
    echo ""
    echo "📊 APPLICATION STATUS"
    echo "---------------------"
    
    # Git status
    echo "Current commit: $(git rev-parse --short HEAD)"
    echo "Branch: $(git rev-parse --abbrev-ref HEAD)"
    echo "Last updated: $(git log -1 --format='%ci')"
    
    # PM2 status
    echo ""
    pm2 status
    
    # Health check
    echo ""
    if api_health_check; then
        print_status "OK" "API is healthy"
    else
        print_status "ERROR" "API is not responding"
    fi
    
    if curl -s -f "http://localhost:3000" > /dev/null 2>&1; then
        print_status "OK" "Web is healthy"
    else
        print_status "ERROR" "Web is not responding"
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS] [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy                 Perform full deployment (default)"
    echo "  status                 Show deployment status"
    echo "  rollback               Rollback to previous version"
    echo "  health                 Perform health check only"
    echo ""
    echo "Options:"
    echo "  -e, --env ENV          Environment (production|staging, default: production)"
    echo "  -d, --dir DIR          Application directory (default: /var/www/cofounderbay)"
    echo "  -t, --timeout SECONDS  Health check timeout (default: 300)"
    echo "  --no-rollback          Disable automatic rollback on failure"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  ENVIRONMENT            Deployment environment"
    echo "  APP_DIR                Application directory"
    echo "  BACKUP_DIR             Backup directory"
    echo "  HEALTH_CHECK_TIMEOUT  Health check timeout in seconds"
    echo ""
    echo "Examples:"
    echo "  $0                     # Deploy to production"
    echo "  $0 -e staging          # Deploy to staging"
    echo "  $0 status              # Show status"
    echo "  $0 rollback            # Rollback deployment"
}

# Parse command line arguments
COMMAND="deploy"
while [[ $# -gt 0 ]]; do
    case $1 in
        deploy|status|rollback|health)
            COMMAND="$1"
            shift
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -d|--dir)
            APP_DIR="$2"
            shift 2
            ;;
        -t|--timeout)
            HEALTH_CHECK_TIMEOUT="$2"
            shift 2
            ;;
        --no-rollback)
            ROLLBACK_ON_FAILURE=false
            shift
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

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Main execution
main() {
    log_message "Starting deployment: $COMMAND (environment: $ENVIRONMENT)"
    
    case $COMMAND in
        deploy)
            print_status "INFO" "Starting deployment to $ENVIRONMENT environment..."
            
            # Run deployment steps
            check_prerequisites
            create_backup
            update_code
            install_dependencies
            build_applications
            run_migrations
            deploy_applications
            
            # Health check
            if health_check; then
                cleanup
                print_status "OK" "Deployment completed successfully!"
                log_message "Deployment completed successfully"
            else
                print_status "ERROR" "Deployment failed health checks"
                log_message "Deployment failed health checks"
                
                if [ "$ROLLBACK_ON_FAILURE" = true ]; then
                    rollback_deployment
                else
                    print_status "WARNING" "Rollback disabled, manual intervention required"
                    exit 1
                fi
            fi
            ;;
            
        status)
            show_status
            ;;
            
        rollback)
            rollback_deployment
            ;;
            
        health)
            if health_check; then
                print_status "OK" "All health checks passed"
                exit 0
            else
                print_status "ERROR" "Health checks failed"
                exit 1
            fi
            ;;
            
        *)
            print_status "ERROR" "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'print_status "WARNING" "Deployment interrupted"; exit 1' INT TERM

# Run main function
main
