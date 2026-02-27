const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool = null;

const connectDB = async () => {
  try {
    const connectionString = process.env.DATABASE_URL || process.env.PG_URI;
    if (!connectionString) {
      throw new Error('DATABASE_URL or PG_URI is required for PostgreSQL');
    }

    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('neon.tech') || connectionString.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('PostgreSQL (Neon) Connected');
  } catch (error) {
    logger.error('PostgreSQL connection failed', error);
    process.exit(1);
  }
};

const getPool = () => {
  if (!pool) throw new Error('Database not connected');
  return pool;
};

const query = (text, params) => getPool().query(text, params);

module.exports = { connectDB, getPool, query };
