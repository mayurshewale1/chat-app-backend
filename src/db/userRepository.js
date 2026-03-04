const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

const nano = () => Math.random().toString(36).replace(/[^0-9A-Z]/gi, '').substr(0, 8).toUpperCase();

const findByUsername = async (username) => {
  const res = await query('SELECT * FROM users WHERE username = $1', [username]);
  return res.rows[0] || null;
};

const findByUid = async (uid) => {
  const res = await query('SELECT id, uid, username, display_name, avatar, app_logo FROM users WHERE uid = $1', [uid]);
  return res.rows[0] || null;
};

const findById = async (id, excludePassword = true) => {
  const cols = excludePassword ? 'id, uid, username, display_name, avatar, app_logo, recovery_email, last_seen, subscription_expires_at, created_at' : '*';
  const res = await query(`SELECT ${cols} FROM users WHERE id = $1`, [id]);
  return res.rows[0] || null;
};

const updateLastSeen = async (userId) => {
  await query('UPDATE users SET last_seen = NOW() WHERE id = $1', [userId]);
};

const findByUsernameOrEmail = async (username, email) => {
  const res = await query(
    'SELECT * FROM users WHERE username = $1 OR recovery_email = $2',
    [username, email]
  );
  return res.rows[0] || null;
};

const create = async ({ username, password, displayName, recoveryEmail }) => {
  const uid = `SRN-${nano()}`;
  const hashedPassword = await bcrypt.hash(password, 10);
  const email = String(recoveryEmail).trim().toLowerCase();

  const res = await query(
    `INSERT INTO users (username, password, recovery_email, display_name, uid)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, uid, username, display_name, avatar, recovery_email, created_at`,
    [username, hashedPassword, email, displayName || null, uid]
  );
  return res.rows[0];
};

const comparePassword = (plain, hashed) => bcrypt.compare(plain, hashed);

const updateProfile = async (userId, { displayName, avatar, app_logo, subscription_expires_at }) => {
  const updates = [];
  const values = [];
  let i = 1;
  if (displayName !== undefined) {
    updates.push(`display_name = $${i++}`);
    values.push(displayName);
  }
  if (avatar !== undefined) {
    updates.push(`avatar = $${i++}`);
    values.push(avatar);
  }
  if (app_logo !== undefined) {
    updates.push(`app_logo = $${i++}`);
    values.push(app_logo);
  }
  if (subscription_expires_at !== undefined) {
    updates.push(`subscription_expires_at = $${i++}`);
    values.push(subscription_expires_at);
  }
  if (updates.length === 0) return findById(userId);
  values.push(userId);
  const res = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, uid, username, display_name, avatar, app_logo, subscription_expires_at, created_at`,
    values
  );
  return res.rows[0] || null;
};

module.exports = {
  findByUsername,
  findByUid,
  findById,
  findByUsernameOrEmail,
  create,
  comparePassword,
  updateProfile,
  updateLastSeen,
};
