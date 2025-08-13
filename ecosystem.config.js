module.exports = {
  apps: [
    {
      name: 'linkedin-scraper',
      script: 'index.js',
      instances: 1, // Single instance for now due to browser resource usage
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        ADAPTIVE_MODE: 'true',
        VERBOSE_LOGGING: 'true'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        ADAPTIVE_MODE: 'true',
        VERBOSE_LOGGING: 'false'
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
        ADAPTIVE_MODE: 'true',
        VERBOSE_LOGGING: 'true'
      },
      // Logging configuration
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Advanced PM2 features
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Health monitoring
      health_check_grace_period: 30000,
      health_check_fatal_exceptions: true,
      
      // Cluster settings (disabled for browser-based app)
      exec_mode: 'fork', // Use fork mode instead of cluster for Puppeteer
      
      // Environment-specific overrides
      node_args: '--max-old-space-size=2048', // 2GB memory limit for Node.js
      
      // Graceful shutdown
      kill_timeout: 30000,
      listen_timeout: 10000,
      
      // Auto-restart conditions
      ignore_watch: [
        'node_modules',
        'logs',
        '*.log',
        'api-patterns-database.json',
        'scraper.log'
      ],
      
      // Custom startup script
      pre_start: 'echo "Starting LinkedIn Banner Extraction System..."',
      post_start: 'echo "System started successfully on port $PORT"'
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-production-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/linkedin-scraper.git',
      path: '/var/www/linkedin-scraper',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci --only=production && npx puppeteer browsers install chrome && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    },
    staging: {
      user: 'deploy',
      host: 'your-staging-server.com',
      ref: 'origin/develop',
      repo: 'git@github.com:your-repo/linkedin-scraper.git',
      path: '/var/www/linkedin-scraper-staging',
      'post-deploy': 'npm ci && npx puppeteer browsers install chrome && pm2 reload ecosystem.config.js --env staging'
    }
  }
};