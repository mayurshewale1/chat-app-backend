const fs = require('fs');
const path = require('path');
const { getPool } = require('../config/db');
const logger = require('../utils/logger');

const runSchema = async () => {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const pool = getPool();
  await pool.query(sql);
  logger.info('Schema applied');
};

module.exports = { runSchema };
