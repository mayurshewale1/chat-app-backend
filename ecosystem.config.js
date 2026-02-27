/**
 * PM2 ecosystem config for RHEL VPS production
 * Usage: pm2 start ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: 'chat-api',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '~/.pm2/logs/chat-api-error.log',
      out_file: '~/.pm2/logs/chat-api-out.log',
      merge_logs: true,
      autorestart: true,
      watch: false,
    },
  ],
};
