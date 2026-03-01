const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config');
const { connectDB, getPool } = require('./config/db');
const initSockets = require('./sockets');
const logger = require('./utils/logger');

dotenv.config();

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', err);
  process.exit(1);
});

const server = http.createServer(app);

async function start() {
  await connectDB();

  const { runSchema } = require('./db/runSchema');
  await runSchema();

  require('./jobs/expiryJob');

  const io = new Server(server, {
    cors: {
      origin: config.CORS_ALLOW_ALL ? '*' : config.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: config.CORS_ALLOW_ALL ? false : true,
    },
  });

  initSockets(io);
  require('./ioHolder').setIo(io);

  server.listen(config.PORT, () => {
    logger.info(`Server running on port ${config.PORT}`);
  });
}

function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    try {
      const pool = getPool();
      pool.end().catch(() => {}).finally(() => process.exit(0));
    } catch {
      process.exit(0);
    }
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start().catch(err => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
