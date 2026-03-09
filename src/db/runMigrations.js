#!/usr/bin/env node
/**
 * Run database migrations from backend folder:
 *   npm run migrate
 *
 * Uses DATABASE_URL or PG_URI from .env
 */
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const { connectDB, getPool } = require('../config/db');
const logger = require('../utils/logger');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const runMigrations = async () => {
  try {
    await connectDB();
    const pool = getPool();

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      logger.info('No migration files found');
      process.exit(0);
    }

    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      logger.info(`Running migration: ${file}`);
      await pool.query(sql);
      logger.info(`Done: ${file}`);
    }

    logger.info('Migrations completed');
    process.exit(0);
  } catch (err) {
    logger.error('Migration failed', err);
    process.exit(1);
  }
};

runMigrations();
