require('express-async-errors');
const path = require('path');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const hpp = require('hpp');
const morgan = require('morgan');
const { errorHandler } = require('./middlewares/errorHandler');
const routes = require('./routes');
const config = require('./config');

const app = express();

// Required when behind Nginx/reverse proxy - express-rate-limit uses X-Forwarded-For for client IP
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: config.CORS_ALLOW_ALL ? true : config.FRONTEND_URL,
  credentials: true,
}));
app.use(hpp());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', async (req, res) => {
  try {
    const { getPool } = require('./config/db');
    await getPool().query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'disconnected', timestamp: new Date().toISOString() });
  }
});

app.use('/api', routes);
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  },
}));

app.use(errorHandler);

module.exports = app;
