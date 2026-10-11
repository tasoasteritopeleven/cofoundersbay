#!/bin/bash

# CoFounderBay Production Setup Script
# This script prepares the application for production deployment

set -e

echo "🚀 CoFounderBay Production Setup"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_status "Starting production setup..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
pnpm install
print_status "Dependencies installed"

# 2. Build shared package
echo "🔨 Building shared package..."
cd packages/shared
pnpm run build
cd ../..
print_status "Shared package built"

# 3. Build API
echo "🏗️  Building API..."
cd apps/api
pnpm run build
cd ../..
print_status "API built"

# 4. Build Web
echo "🌐 Building Web..."
cd apps/web
pnpm run build
cd ../..
print_status "Web built"

# 5. Database setup
echo "🗄️  Setting up database..."
cd apps/api

# Check if database is available
if ! npx prisma db push --accept-data-loss 2>/dev/null; then
    print_warning "Database not available - please run: docker compose up -d"
    echo "Then run: cd apps/api && npx prisma db push"
else
    print_status "Database schema pushed"
    
    # Run migrations
    if [ -d "prisma/migrations" ]; then
        npx prisma migrate deploy
        print_status "Database migrations applied"
    fi
    
    # Generate Prisma client
    npx prisma generate
    print_status "Prisma client generated"
fi

cd ../..

# 6. Environment setup
echo "🔧 Setting up environment..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning "Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update .env file with your production values"
fi

# Check for required environment variables
required_vars=("DATABASE_URL" "JWT_ACCESS_SECRET" "NEXT_PUBLIC_API_URL")
missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env 2>/dev/null; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    print_error "Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    echo "Please update your .env file"
    exit 1
fi

print_status "Environment variables verified"

# 7. Performance optimizations
echo "⚡ Performance optimizations..."

# Set up PM2 if available
if command -v pm2 &> /dev/null; then
    print_status "PM2 found - creating ecosystem file..."
    
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'cofounderbay-api',
      script: './apps/api/dist/main.js',
      cwd: './',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024'
    },
    {
      name: 'cofounderbay-web',
      script: 'npx',
      args: 'next start',
      cwd: './apps/web',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_file: './logs/web-combined.log',
      time: true
    }
  ]
};
EOF
    
    print_status "PM2 ecosystem file created"
else
    print_warning "PM2 not found - please install it: npm install -g pm2"
fi

# 8. Create logs directory
mkdir -p logs
print_status "Logs directory created"

# 9. Health check setup
echo "🏥 Setting up health checks..."

# Create health check script
cat > scripts/health-check.sh << 'EOF'
#!/bin/bash

echo "🏥 CoFounderBay Health Check"
echo "=========================="

# Check API health
echo "Checking API health..."
curl -f http://localhost:3001/api/v1/health || echo "❌ API health check failed"

# Check Web health
echo "Checking Web health..."
curl -f http://localhost:3000 || echo "❌ Web health check failed"

# Check Database
echo "Checking Database..."
cd apps/api && npx prisma db execute --stdin << 'SQL'
SELECT 1 as health_check;
SQL

echo "✅ Health check completed"
EOF

chmod +x scripts/health-check.sh
print_status "Health check script created"

# 10. Create backup script
echo "💾 Creating backup script..."

cat > scripts/backup.sh << 'EOF'
#!/bin/bash

# CoFounderBay Database Backup Script

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/cofounderbay_backup_$TIMESTAMP.sql"

echo "🗄️  Creating database backup..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
cd apps/api
npx prisma db pull --schema-output $BACKUP_FILE

echo "✅ Backup created: $BACKUP_FILE"

# Clean up old backups (keep last 7 days)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete

echo "🧹 Old backups cleaned up"
EOF

chmod +x scripts/backup.sh
print_status "Backup script created"

# 11. Create monitoring script
echo "📊 Creating monitoring script..."

cat > scripts/monitor.sh << 'EOF'
#!/bin/bash

# CoFounderBay Monitoring Script

echo "📊 CoFounderBay System Monitor"
echo "=========================="

# Get API health
API_HEALTH=$(curl -s http://localhost:3001/api/v1/health | jq -r '.status // "unknown"')
echo "API Status: $API_HEALTH"

# Get system resources
echo "System Resources:"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')"
echo "Memory: $(free -h | grep Mem | awk '{print $3"/"$4}')"
echo "Disk: $(df -h / | tail -1 | awk '{print $3"/"$4}')"

# Get process status
if command -v pm2 &> /dev/null; then
    echo "PM2 Status:"
    pm2 status
fi

echo "✅ Monitoring completed"
EOF

chmod +x scripts/monitor.sh
print_status "Monitoring script created"

# 12. Create deployment script
echo "🚀 Creating deployment script..."

cat > scripts/deploy.sh << 'EOF'
#!/bin/bash

# CoFounderBay Deployment Script

set -e

echo "🚀 CoFounderBay Deployment"
echo "======================"

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build packages
echo "🔨 Building packages..."
cd packages/shared && pnpm run build && cd ../..
cd apps/api && pnpm run build && cd ../..
cd apps/web && pnpm run build && cd ../..

# Database migrations
echo "🗄️  Running database migrations..."
cd apps/api
npx prisma migrate deploy
npx prisma generate
cd ../..

# Restart services
if command -v pm2 &> /dev/null; then
    echo "🔄 Restarting services..."
    pm2 reload all
    pm2 status
else
    echo "⚠️  PM2 not found - please restart services manually"
fi

echo "✅ Deployment completed"
EOF

chmod +x scripts/deploy.sh
print_status "Deployment script created"

# 13. Create production .env template
echo "📝 Creating production environment template..."

cat > .env.production << 'EOF'
# Production Environment Variables
NODE_ENV=production

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/cofounderbay

# JWT
JWT_ACCESS_SECRET=your-super-secret-jwt-access-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-jwt-refresh-key-min-32-chars
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# API Configuration
API_PORT=3001
API_PREFIX=api/v1

# Frontend Configuration
NEXT_PUBLIC_API_URL=https://your-domain.com/api/v1

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Search (Meilisearch)
MEILISEARCH_HOST=localhost
MEILISEARCH_PORT=7700
MEILISEARCH_MASTER_KEY=your-meilisearch-master-key

# Email
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@your-domain.com

# Storage
STORAGE_PROVIDER=local
# For S3:
# AWS_ACCESS_KEY_ID=your-access-key
# AWS_SECRET_ACCESS_KEY=your-secret-key
# AWS_REGION=us-east-1
# AWS_S3_BUCKET=your-bucket-name

# CORS
CORS_ORIGIN=https://your-domain.com

# Features
FEATURE_REGISTRATION=true
FEATURE_EMAIL_VERIFICATION=true
FEATURE_PROFILE_VERIFICATION=false
FEATURE_MESSAGING=true
FEATURE_EVENTS=true
FEATURE_GROUPS=true
FEATURE_MENTORING=true
FEATURE_JOBS=true
FEATURE_BILLING=false

# Monitoring
MONITORING_ENABLED=true
LOG_LEVEL=info
STRUCTURED_LOGGING=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Database Pool
DATABASE_POOL_SIZE=20
DATABASE_SSL=false
EOF

print_status "Production environment template created"

# 14. Final checks
echo "🔍 Running final checks..."

# Check if all required files exist
required_files=(
    "packages/shared/dist/index.js"
    "apps/api/dist/main.js"
    "apps/web/.next"
    ".env"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        print_status "$file exists"
    else
        print_error "$file missing"
    fi
done

echo ""
echo "🎉 Production setup completed!"
echo ""
echo "Next steps:"
echo "1. Update .env with your production values"
echo "2. Start your database: docker compose up -d"
echo "3. Run database migrations: cd apps/api && npx prisma db push"
echo "4. Start the application: pm2 start ecosystem.config.js"
echo "5. Run health check: ./scripts/health-check.sh"
echo ""
echo "Useful commands:"
echo "- Deploy: ./scripts/deploy.sh"
echo "- Monitor: ./scripts/monitor.sh"
echo "- Backup: ./scripts/backup.sh"
echo "- Health check: ./scripts/health-check.sh"
echo ""
echo "🚀 Ready for production!"
