#!/bin/bash

# CoFounderBay Backup Script
# This script creates automated backups of database, files, and configuration

set -e

echo "💾 CoFounderBay Backup System"
echo "============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR=${BACKUP_DIR:-"/var/backups/cofounderbay"}
RETENTION_DAYS=${RETENTION_DAYS:-30}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="cofounderbay_backup_${TIMESTAMP}"

# Database configuration
DB_HOST=${DATABASE_HOST:-localhost}
DB_PORT=${DATABASE_PORT:-5432}
DB_NAME=${DATABASE_NAME:-cofounderbay}
DB_USER=${DATABASE_USER:-postgres}
DB_PASSWORD=${DATABASE_PASSWORD:-}

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

# Function to create backup directory
create_backup_dir() {
    print_status "INFO" "Creating backup directory..."
    
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        print_status "OK" "Created backup directory: $BACKUP_DIR"
    else
        print_status "OK" "Backup directory exists: $BACKUP_DIR"
    fi
    
    # Create specific backup folder
    local current_backup_dir="$BACKUP_DIR/$BACKUP_NAME"
    mkdir -p "$current_backup_dir"
    echo "$current_backup_dir"
}

# Function to backup PostgreSQL database
backup_database() {
    local backup_dir=$1
    print_status "INFO" "Backing up PostgreSQL database..."
    
    local db_backup_file="$backup_dir/database.sql"
    
    if command -v pg_dump &> /dev/null; then
        if PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$db_backup_file" 2>/dev/null; then
            # Compress the backup
            gzip "$db_backup_file"
            print_status "OK" "Database backup completed: ${db_backup_file}.gz"
            
            # Verify backup
            local backup_size=$(stat -f%z "${db_backup_file}.gz" 2>/dev/null || stat -c%s "${db_backup_file}.gz" 2>/dev/null)
            if [ "$backup_size" -gt 0 ]; then
                print_status "OK" "Database backup size: $(du -h "${db_backup_file}.gz" | cut -f1)"
            else
                print_status "ERROR" "Database backup appears to be empty"
                return 1
            fi
        else
            print_status "ERROR" "Failed to backup database"
            return 1
        fi
    else
        print_status "ERROR" "pg_dump not available"
        return 1
    fi
}

# Function to backup application files
backup_files() {
    local backup_dir=$1
    print_status "INFO" "Backing up application files..."
    
    # Create files backup
    local files_backup_file="$backup_dir/files.tar.gz"
    
    # Important directories to backup
    local dirs_to_backup=(
        "apps/api/uploads"
        "apps/web/public"
        "logs"
        "scripts"
        "config"
    )
    
    # Only backup existing directories
    local existing_dirs=()
    for dir in "${dirs_to_backup[@]}"; do
        if [ -d "$dir" ]; then
            existing_dirs+=("$dir")
        fi
    done
    
    if [ ${#existing_dirs[@]} -gt 0 ]; then
        tar -czf "$files_backup_file" "${existing_dirs[@]}" 2>/dev/null
        print_status "OK" "Files backup completed: $(du -h "$files_backup_file" | cut -f1)"
    else
        print_status "WARNING" "No application directories found to backup"
    fi
}

# Function to backup configuration files
backup_config() {
    local backup_dir=$1
    print_status "INFO" "Backing up configuration files..."
    
    local config_backup_file="$backup_dir/config.tar.gz"
    
    # Configuration files to backup
    local config_files=(
        ".env"
        ".env.production"
        ".env.staging"
        "ecosystem.config.js"
        "docker-compose.yml"
        "docker-compose.prod.yml"
        "nginx.conf"
        "package.json"
        "apps/api/package.json"
        "apps/web/package.json"
    )
    
    # Only backup existing files
    local existing_files=()
    for file in "${config_files[@]}"; do
        if [ -f "$file" ]; then
            existing_files+=("$file")
        fi
    done
    
    if [ ${#existing_files[@]} -gt 0 ]; then
        tar -czf "$config_backup_file" "${existing_files[@]}" 2>/dev/null
        print_status "OK" "Configuration backup completed: $(du -h "$config_backup_file" | cut -f1)"
    else
        print_status "WARNING" "No configuration files found to backup"
    fi
}

# Function to backup Redis data
backup_redis() {
    local backup_dir=$1
    print_status "INFO" "Backing up Redis data..."
    
    local redis_backup_file="$backup_dir/redis.rdb"
    local redis_host=${REDIS_HOST:-localhost}
    local redis_port=${REDIS_PORT:-6379}
    
    if command -v redis-cli &> /dev/null; then
        # Trigger Redis BGSAVE
        if redis-cli -h "$redis_host" -p "$redis_port" BGSAVE > /dev/null 2>&1; then
            print_status "INFO" "Redis backup initiated, waiting for completion..."
            
            # Wait for backup to complete
            local max_wait=30
            local wait_time=0
            while [ $wait_time -lt $max_wait ]; do
                local lastsave=$(redis-cli -h "$redis_host" -p "$redis_port" LASTSAVE)
                local current_time=$(date +%s)
                
                if [ $((current_time - lastsave)) -lt 5 ]; then
                    break
                fi
                
                sleep 1
                wait_time=$((wait_time + 1))
            done
            
            # Copy RDB file
            local redis_data_dir=$(redis-cli -h "$redis_host" -p "$redis_port" CONFIG GET "dir" | tail -1)
            local redis_db_file="$redis_data_dir/dump.rdb"
            
            if [ -f "$redis_db_file" ]; then
                cp "$redis_db_file" "$redis_backup_file"
                gzip "$redis_backup_file"
                print_status "OK" "Redis backup completed: $(du -h "${redis_backup_file}.gz" | cut -f1)"
            else
                print_status "WARNING" "Redis RDB file not found"
            fi
        else
            print_status "WARNING" "Could not trigger Redis backup"
        fi
    else
        print_status "WARNING" "redis-cli not available"
    fi
}

# Function to create backup manifest
create_manifest() {
    local backup_dir=$1
    print_status "INFO" "Creating backup manifest..."
    
    local manifest_file="$backup_dir/manifest.json"
    
    cat > "$manifest_file" << EOF
{
  "backup_name": "$BACKUP_NAME",
  "timestamp": "$(date -Iseconds)",
  "created_by": "$(whoami)",
  "hostname": "$(hostname)",
  "system_info": {
    "os": "$(uname -s -r)",
    "kernel": "$(uname -r)",
    "architecture": "$(uname -m)"
  },
  "backup_components": {
    "database": {
      "host": "$DB_HOST",
      "port": "$DB_PORT",
      "name": "$DB_NAME",
      "file": "database.sql.gz"
    },
    "files": {
      "file": "files.tar.gz"
    },
    "config": {
      "file": "config.tar.gz"
    },
    "redis": {
      "file": "redis.rdb.gz"
    }
  },
  "backup_size": "$(du -sh "$backup_dir" | cut -f1)",
  "file_count": "$(find "$backup_dir" -type f | wc -l)"
}
EOF
    
    print_status "OK" "Backup manifest created: $manifest_file"
}

# Function to cleanup old backups
cleanup_old_backups() {
    print_status "INFO" "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
    
    local deleted_count=0
    while IFS= read -r -d '' backup; do
        rm -rf "$backup"
        deleted_count=$((deleted_count + 1))
    done < <(find "$BACKUP_DIR" -maxdepth 1 -type d -name "cofounderbay_backup_*" -mtime +$RETENTION_DAYS -print0)
    
    if [ "$deleted_count" -gt 0 ]; then
        print_status "OK" "Deleted $deleted_count old backup(s)"
    else
        print_status "INFO" "No old backups to delete"
    fi
}

# Function to verify backup integrity
verify_backup() {
    local backup_dir=$1
    print_status "INFO" "Verifying backup integrity..."
    
    local errors=0
    
    # Check database backup
    if [ -f "$backup_dir/database.sql.gz" ]; then
        if gzip -t "$backup_dir/database.sql.gz" 2>/dev/null; then
            print_status "OK" "Database backup integrity verified"
        else
            print_status "ERROR" "Database backup is corrupted"
            errors=$((errors + 1))
        fi
    else
        print_status "WARNING" "Database backup not found"
    fi
    
    # Check files backup
    if [ -f "$backup_dir/files.tar.gz" ]; then
        if tar -tzf "$backup_dir/files.tar.gz" > /dev/null 2>&1; then
            print_status "OK" "Files backup integrity verified"
        else
            print_status "ERROR" "Files backup is corrupted"
            errors=$((errors + 1))
        fi
    else
        print_status "WARNING" "Files backup not found"
    fi
    
    # Check config backup
    if [ -f "$backup_dir/config.tar.gz" ]; then
        if tar -tzf "$backup_dir/config.tar.gz" > /dev/null 2>&1; then
            print_status "OK" "Configuration backup integrity verified"
        else
            print_status "ERROR" "Configuration backup is corrupted"
            errors=$((errors + 1))
        fi
    else
        print_status "WARNING" "Configuration backup not found"
    fi
    
    # Check manifest
    if [ -f "$backup_dir/manifest.json" ]; then
        if python -m json.tool "$backup_dir/manifest.json" > /dev/null 2>&1; then
            print_status "OK" "Backup manifest is valid"
        else
            print_status "ERROR" "Backup manifest is invalid"
            errors=$((errors + 1))
        fi
    else
        print_status "WARNING" "Backup manifest not found"
    fi
    
    return $errors
}

# Function to restore backup
restore_backup() {
    local backup_name=$1
    local backup_dir="$BACKUP_DIR/$backup_name"
    
    if [ ! -d "$backup_dir" ]; then
        print_status "ERROR" "Backup not found: $backup_name"
        return 1
    fi
    
    print_status "INFO" "Restoring from backup: $backup_name"
    
    # Restore database
    if [ -f "$backup_dir/database.sql.gz" ]; then
        print_status "INFO" "Restoring database..."
        if gunzip -c "$backup_dir/database.sql.gz" | PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"; then
            print_status "OK" "Database restored successfully"
        else
            print_status "ERROR" "Failed to restore database"
            return 1
        fi
    fi
    
    # Restore files
    if [ -f "$backup_dir/files.tar.gz" ]; then
        print_status "INFO" "Restoring files..."
        if tar -xzf "$backup_dir/files.tar.gz"; then
            print_status "OK" "Files restored successfully"
        else
            print_status "ERROR" "Failed to restore files"
            return 1
        fi
    fi
    
    # Restore configuration
    if [ -f "$backup_dir/config.tar.gz" ]; then
        print_status "INFO" "Restoring configuration..."
        if tar -xzf "$backup_dir/config.tar.gz"; then
            print_status "OK" "Configuration restored successfully"
        else
            print_status "ERROR" "Failed to restore configuration"
            return 1
        fi
    fi
    
    print_status "OK" "Backup restore completed"
}

# Function to list available backups
list_backups() {
    print_status "INFO" "Available backups:"
    
    if [ -d "$BACKUP_DIR" ]; then
        local backup_count=0
        while IFS= read -r backup; do
            backup_count=$((backup_count + 1))
            local backup_name=$(basename "$backup")
            local backup_date=$(echo "$backup_name" | grep -o '[0-9]\{8\}_[0-9]\{6\}' | sed 's/_/ /')
            local backup_size=$(du -sh "$backup" | cut -f1)
            
            echo "  $backup_count) $backup_name ($backup_size) - $backup_date"
        done < <(find "$BACKUP_DIR" -maxdepth 1 -type d -name "cofounderbay_backup_*" | sort -r)
        
        if [ "$backup_count" -eq 0 ]; then
            print_status "INFO" "No backups found"
        fi
    else
        print_status "INFO" "Backup directory does not exist"
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS] [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  backup                 Create a new backup (default)"
    echo "  restore BACKUP_NAME    Restore from backup"
    echo "  list                   List available backups"
    echo "  verify BACKUP_NAME     Verify backup integrity"
    echo "  cleanup                Clean up old backups"
    echo ""
    echo "Options:"
    echo "  -d, --dir DIR          Backup directory (default: /var/backups/cofounderbay)"
    echo "  -r, --retention DAYS   Retention period in days (default: 30)"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_HOST          Database host (default: localhost)"
    echo "  DATABASE_PORT          Database port (default: 5432)"
    echo "  DATABASE_NAME          Database name (default: cofounderbay)"
    echo "  DATABASE_USER          Database user (default: postgres)"
    echo "  DATABASE_PASSWORD      Database password"
    echo "  REDIS_HOST             Redis host (default: localhost)"
    echo "  REDIS_PORT             Redis port (default: 6379)"
    echo ""
    echo "Examples:"
    echo "  $0                     # Create backup"
    echo "  $0 -d /tmp/backups     # Custom backup directory"
    echo "  $0 list                # List backups"
    echo "  $0 restore backup_20240317_120000 # Restore backup"
}

# Parse command line arguments
COMMAND="backup"
while [[ $# -gt 0 ]]; do
    case $1 in
        backup|restore|list|verify|cleanup)
            COMMAND="$1"
            shift
            ;;
        -d|--dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -r|--retention)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            if [ "$COMMAND" = "restore" ] || [ "$COMMAND" = "verify" ]; then
                BACKUP_NAME="$1"
                shift
            else
                echo "Unknown option: $1"
                show_help
                exit 1
            fi
            ;;
    esac
done

# Main execution
case $COMMAND in
    backup)
        print_status "INFO" "Starting backup process..."
        
        # Create backup directory
        backup_dir=$(create_backup_dir)
        
        # Perform backup components
        backup_database "$backup_dir"
        backup_files "$backup_dir"
        backup_config "$backup_dir"
        backup_redis "$backup_dir"
        
        # Create manifest and verify
        create_manifest "$backup_dir"
        verify_backup "$backup_dir"
        
        # Cleanup old backups
        cleanup_old_backups
        
        print_status "OK" "Backup completed successfully: $backup_dir"
        ;;
        
    restore)
        if [ -z "$BACKUP_NAME" ]; then
            print_status "ERROR" "Please specify backup name to restore"
            echo "Available backups:"
            list_backups
            exit 1
        fi
        
        restore_backup "$BACKUP_NAME"
        ;;
        
    list)
        list_backups
        ;;
        
    verify)
        if [ -z "$BACKUP_NAME" ]; then
            print_status "ERROR" "Please specify backup name to verify"
            echo "Available backups:"
            list_backups
            exit 1
        fi
        
        verify_backup "$BACKUP_DIR/$BACKUP_NAME"
        ;;
        
    cleanup)
        cleanup_old_backups
        ;;
        
    *)
        print_status "ERROR" "Unknown command: $COMMAND"
        show_help
        exit 1
        ;;
esac
