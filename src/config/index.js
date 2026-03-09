require('dotenv').config();

const API_VERSION = process.env.API_VERSION || 'v1';
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const CORS_ALLOW_ALL = process.env.CORS_ALLOW_ALL === 'true';

const JWT_SECRET = process.env.JWT_SECRET || (NODE_ENV === 'production' ? null : 'change_this_to_a_strong_secret');
if (!JWT_SECRET && NODE_ENV === 'production') {
  require('./utils/logger').error('FATAL: JWT_SECRET must be set in production');
  process.exit(1);
}
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// TURN servers for WebRTC calls across different networks (WiFi vs mobile data, etc.)
// Option A: Metered API - set METERED_APP_NAME + METERED_API_KEY (fetches fresh credentials)
// Option B: Static - set TURN_URL, TURN_USERNAME, TURN_CREDENTIAL
const METERED_APP_NAME = process.env.METERED_APP_NAME; // e.g. chatapplicationsecure
const METERED_API_KEY = process.env.METERED_API_KEY;
const TURN_URL = process.env.TURN_URL;
const TURN_USERNAME = process.env.TURN_USERNAME;
const TURN_CREDENTIAL = process.env.TURN_CREDENTIAL;

module.exports = {
  API_VERSION,
  PORT,
  NODE_ENV,
  DATABASE_URL,
  FRONTEND_URL,
  CORS_ALLOW_ALL,
  JWT_SECRET,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  LOG_LEVEL,
  METERED_APP_NAME,
  METERED_API_KEY,
  TURN_URL,
  TURN_USERNAME,
  TURN_CREDENTIAL,
};
