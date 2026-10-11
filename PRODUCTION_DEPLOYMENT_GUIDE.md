# 🚀 CoFounderBay Production Deployment Guide

This guide covers the complete process of deploying CoFounderBay to production environment.

## 📋 Prerequisites

### Infrastructure Requirements
- **Node.js** 20+ 
- **PostgreSQL** 14+
- **Redis** 6+
- **Meilisearch** (optional, for search)
- **PM2** (for process management)
- **Nginx** (for reverse proxy)

### Domain & SSL
- Registered domain name
- SSL certificate (Let's Encrypt recommended)
- DNS configuration

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx (80/443) │    │     PM2        │    │   Docker Compose │
│   (Reverse Proxy) │◄──►│  (Process Mgr)  │◄──►│ (DB, Redis, Search)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App    │    │   NestJS API    │    │   PostgreSQL    │
│   (Port 3000)    │    │   (Port 3001)    │    │   (Port 5432)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📦 Step-by-Step Deployment

### 1. Server Setup

#### 1.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
```

#### 1.2 Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 1.3 Install PM2
```bash
npm install -g pm2
```

#### 1.4 Install Nginx
```bash
sudo apt install nginx -y
```

#### 1.5 Install Docker (for services)
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 2. Application Setup

#### 2.1 Clone Repository
```bash
git clone https://github.com/your-username/cofoundersbay.git
cd cofoundersbay
```

#### 2.2 Install Dependencies
```bash
chmod +x scripts/production-setup.sh
./scripts/production-setup.sh
```

#### 2.3 Configure Environment
```bash
cp .env.production .env
# Edit .env with your production values
```

### 3. Database Setup

#### 3.1 Start Database Services
```bash
docker compose up -d postgres redis
```

#### 3.2 Run Database Migrations
```bash
cd apps/api
npx prisma db push
npx prisma generate
cd ../..
```

#### 3.3 Verify Database
```bash
cd apps/api
npx prisma studio
# Check that tables are created correctly
```

### 4. SSL Certificate Setup

#### 4.1 Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

#### 4.2 Obtain SSL Certificate
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

#### 4.3 Auto-renew SSL
```bash
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 5. Nginx Configuration

Create `/etc/nginx/sites-available/cofoundersbay`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Handle large uploads
        client_max_body_size 10M;
        proxy_request_buffering off;
    }

    # Static files and uploads
    location /uploads/ {
        alias /path/to/your/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/cofoundersbay /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Application Deployment

#### 6.1 Build Application
```bash
pnpm run build
```

#### 6.2 Start with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 6.3 Verify Deployment
```bash
# Check PM2 status
pm2 status

# Check application logs
pm2 logs

# Check health endpoints
curl https://yourdomain.com/api/v1/health
curl https://yourdomain.com/health
```

### 7. Monitoring Setup

#### 7.1 PM2 Monitoring
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

#### 7.2 System Monitoring Script
```bash
# Make monitoring script executable
chmod +x scripts/monitor.sh

# Test it
./scripts/monitor.sh
```

#### 7.3 Health Check Automation
Add to crontab:
```bash
# Check application health every 5 minutes
*/5 * * * * /path/to/cofoundersbay/scripts/health-check.sh >> /var/log/cofoundersbay-health.log 2>&1
```

### 8. Backup Strategy

#### 8.1 Database Backups
```bash
# Make backup script executable
chmod +x scripts/backup.sh

# Set up daily backups
crontab -e
# Add: 0 2 * * * /path/to/cofoundersbay/scripts/backup.sh >> /var/log/cofoundersbay-backup.log 2>&1
```

#### 8.2 Application Backups
```bash
# Backup application code and configs
tar -czf /backups/cofoundersbay-app-$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=dist \
  /path/to/cofoundersbay/
```

## 🔧 Configuration Files

### PM2 Ecosystem Config
```javascript
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
      instances: 2,
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
```

### Docker Compose (Services)
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: cofounderbay
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your-password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  meilisearch:
    image: getmeili/meilisearch:v1.5
    environment:
      MEILI_MASTER_KEY: your-master-key
    ports:
      - "7700:7700"
    volumes:
      - meilisearch_data:/meili_data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  meilisearch_data:
```

## 🔍 Testing & Verification

### Pre-deployment Checklist
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] SSL certificate installed
- [ ] Nginx configuration tested
- [ ] Application builds successfully
- [ ] Health endpoints responding
- [ ] Error logging configured
- [ ] Backup scripts tested

### Post-deployment Tests
```bash
# Test all health endpoints
curl https://yourdomain.com/api/v1/health
curl https://yourdomain.com/api/v1/health/readiness
curl https://yourdomain.com/api/v1/health/liveness

# Test main application
curl -I https://yourdomain.com
curl -I https://yourdomain.com/api/v1

# Test database connectivity
curl -X POST https://yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Run full test suite
./scripts/health-check.sh
```

## 📊 Performance Optimization

### Nginx Optimization
```nginx
# Add to server block
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied any;
gzip_comp_level 6;
gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/json
    application/javascript
    application/xml+rss
    application/atom+xml
    image/svg+xml;
```

### Application Optimization
- Enable React Query caching
- Implement CDN for static assets
- Use HTTP/2 for multiplexing
- Optimize database queries with indexes
- Enable Redis caching for frequent data

## 🔒 Security Hardening

### Firewall Configuration
```bash
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw deny 5432  # PostgreSQL (internal only)
sudo ufw deny 6379  # Redis (internal only)
sudo ufw deny 7700  # Meilisearch (internal only)
```

### Security Headers
Already configured in Nginx with:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security

### Environment Security
- Use strong, unique secrets
- Rotate JWT keys regularly
- Enable rate limiting
- Monitor access logs
- Keep dependencies updated

## 🚨 Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check PM2 logs
pm2 logs cofounderbay-api
pm2 logs cofounderbay-web

# Check environment variables
pm2 env cofounderbay-api
pm2 env cofounderbay-web
```

#### Database Connection Errors
```bash
# Test database connectivity
cd apps/api
npx prisma db execute --stdin << 'SQL'
SELECT 1;
SQL

# Check database logs
docker logs postgres
```

#### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew --dry-run
sudo certbot renew
```

#### High Memory Usage
```bash
# Check PM2 memory usage
pm2 monit

# Restart applications if needed
pm2 restart all
```

## 📈 Scaling Considerations

### Horizontal Scaling
- Load balancer (multiple servers)
- Database read replicas
- Redis cluster
- CDN for static assets

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Implement caching layers
- Monitor performance metrics

### Monitoring & Alerting
- Set up application monitoring
- Configure error alerting
- Monitor system resources
- Track performance metrics

## 🔄 Maintenance

### Regular Tasks
- **Daily**: Health checks, log rotation
- **Weekly**: Security updates, backup verification
- **Monthly**: Dependency updates, performance review
- **Quarterly**: Security audit, scaling review

### Emergency Procedures
1. **Application Down**: Check PM2 status, restart services
2. **Database Issues**: Check logs, restore from backup
3. **SSL Issues**: Renew certificates, check Nginx config
4. **High Load**: Scale resources, check for DDoS

## 📞 Support

For deployment issues:
1. Check logs: `pm2 logs`
2. Run health checks: `./scripts/health-check.sh`
3. Monitor system: `./scripts/monitor.sh`
4. Review documentation: Check this guide

---

## 🎉 Success Criteria

Your production deployment is successful when:
- ✅ All health endpoints return 200 OK
- ✅ SSL certificate is valid and auto-renews
- ✅ Application loads without errors
- ✅ Database connections work
- ✅ Caching layer is functional
- ✅ Monitoring is active
- ✅ Backups are running
- ✅ Error logs are clean

🚀 **Your CoFounderBay platform is now production-ready!**
