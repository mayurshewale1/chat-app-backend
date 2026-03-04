const { query } = require('../config/db');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const PREFIX = 'CON-';

const generateCode = () => {
  let result = PREFIX;
  for (let i = 0; i < CODE_LENGTH; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
};

const create = async (userId) => {
  let code;
  let attempts = 0;
  const maxAttempts = 10;
  while (attempts < maxAttempts) {
    code = generateCode();
    const existing = await findByCode(code);
    if (!existing) break;
    attempts++;
  }
  if (attempts >= maxAttempts) {
    throw new Error('Could not generate unique code');
  }
  const res = await query(
    `INSERT INTO connection_codes (user_id, code) VALUES ($1, $2) RETURNING *`,
    [userId, code]
  );
  return res.rows[0];
};

const findByCode = async (code) => {
  const normalized = String(code).trim().toUpperCase();
  const res = await query(
    'SELECT * FROM connection_codes WHERE code = $1 AND used_at IS NULL',
    [normalized]
  );
  return res.rows[0] || null;
};

const markUsed = async (id) => {
  const res = await query(
    'UPDATE connection_codes SET used_at = NOW() WHERE id = $1 RETURNING *',
    [id]
  );
  return res.rows[0] || null;
};

const listActiveByUser = async (userId) => {
  const res = await query(
    `SELECT id, code, created_at FROM connection_codes
     WHERE user_id = $1 AND used_at IS NULL
     ORDER BY created_at DESC`,
    [userId]
  );
  return res.rows;
};

module.exports = {
  create,
  findByCode,
  markUsed,
  listActiveByUser,
};
