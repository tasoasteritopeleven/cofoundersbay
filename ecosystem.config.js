module.exports = {
  apps: [
    {
      name: 'cofounderbay-api',
      script: 'dist/main.js',
      cwd: './apps/api',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
      },
      // Error handling
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true,
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Health checks
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      
      // Process monitoring
      pmx: true,
      
      // Environment variables
      env_file: '.env',
      
      // Additional configuration
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Restart strategy
      max_restarts: 10,
      min_uptime: '10s',
    },
    {
      name: 'cofounderbay-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: './apps/web',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
      },
      // Error handling
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_file: './logs/web-combined.log',
      time: true,
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Health checks
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      
      // Process monitoring
      pmx: true,
      
      // Environment variables
      env_file: '.env',
      
      // Additional configuration
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Restart strategy
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
  
  deploy: {
    production: {
      user: 'deploy',
      host: 'cofounderbay.com',
      ref: 'origin/main',
      repo: 'git@github.com:cofounderbay/cofounderbay.git',
      path: '/var/www/cofounderbay',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
    },
    staging: {
      user: 'deploy',
      host: 'staging.cofounderbay.com',
      ref: 'origin/develop',
      repo: 'git@github.com:cofounderbay/cofounderbay.git',
      path: '/var/www/cofounderbay-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
    },
  },
};
