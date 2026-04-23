const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

const nano = () => Math.random().toString(36).replace(/[^0-9A-Z]/gi, '').substr(0, 8).toUpperCase();

const findByUsername = async (username) => {
  const res = await query('SELECT * FROM users WHERE username = $1 AND COALESCE(active, true) = true', [username]);
  return res.rows[0] || null;
};

const findByUid = async (uid) => {
  const res = await query('SELECT id, uid, username, display_name, avatar, app_logo FROM users WHERE uid = $1', [uid]);
  return res.rows[0] || null;
};

const findById = async (id, excludePassword = true) => {
  const cols = excludePassword
    ? 'id, uid, username, display_name, avatar, app_logo, recovery_email, mobile, last_seen, subscription_expires_at, created_at, privacy_mask_caller, security_question'
    : '*';
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

const findByMobile = async (mobile) => {
  const res = await query('SELECT * FROM users WHERE mobile = $1 AND COALESCE(active, true) = true', [mobile]);
  return res.rows[0] || null;
};

const findByUsernameOrMobile = async (username, mobile) => {
  const res = await query(
    'SELECT * FROM users WHERE username = $1 OR mobile = $2',
    [username, mobile]
  );
  return res.rows[0] || null;
};

const create = async ({ username, password, displayName, recoveryEmail, mobile }) => {
  const uid = `SRN-${nano()}`;
  const hashedPassword = await bcrypt.hash(password, 10);

  if (mobile) {
    const res = await query(
      `INSERT INTO users (username, password, display_name, uid, mobile, terms_accepted_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, uid, username, display_name, avatar, mobile, created_at, terms_accepted_at`,
      [username, hashedPassword, displayName || null, uid, mobile]
    );
    return res.rows[0];
  }

  const email = String(recoveryEmail || '').trim().toLowerCase();
  const res = await query(
    `INSERT INTO users (username, password, recovery_email, display_name, uid, terms_accepted_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id, uid, username, display_name, avatar, recovery_email, created_at, terms_accepted_at`,
    [username, hashedPassword, email || null, displayName || null, uid]
  );
  return res.rows[0];
};

const updatePassword = async (userId, hashedPassword) => {
  const res = await query('UPDATE users SET password = $1 WHERE id = $2 RETURNING id', [hashedPassword, userId]);
  return res.rowCount > 0;
};

const comparePassword = (plain, hashed) => bcrypt.compare(plain, hashed);

const deactivateUser = async (userId) => {
  const res = await query('UPDATE users SET active = false WHERE id = $1 RETURNING id', [userId]);
  return res.rowCount > 0;
};

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

const updateNotificationsEnabled = async (userId, enabled) => {
  const res = await query(
    'UPDATE users SET notifications_enabled = $1 WHERE id = $2 RETURNING id',
    [!!enabled, userId]
  );
  return res.rowCount > 0;
};

const getNotificationsEnabled = async (userId) => {
  const res = await query(
    'SELECT COALESCE(notifications_enabled, true) AS enabled FROM users WHERE id = $1',
    [userId]
  );
  return res.rows[0]?.enabled !== false;
};

const updateReadReceiptsEnabled = async (userId, enabled) => {
  const res = await query(
    'UPDATE users SET read_receipts_enabled = $1 WHERE id = $2 RETURNING id',
    [!!enabled, userId]
  );
  return res.rowCount > 0;
};

const getReadReceiptsEnabled = async (userId) => {
  const res = await query(
    'SELECT COALESCE(read_receipts_enabled, true) AS enabled FROM users WHERE id = $1',
    [userId]
  );
  return res.rows[0]?.enabled !== false;
};

const setSecurityQuestion = async (userId, question, answerPlain) => {
  const q = String(question || '').trim().slice(0, 255);
  if (!q) {
    const err = new Error('Security question is required');
    err.status = 400;
    throw err;
  }
  const a = String(answerPlain || '').trim();
  if (a.length < 2) {
    const err = new Error('Answer must be at least 2 characters');
    err.status = 400;
    throw err;
  }
  const hash = await bcrypt.hash(a.toLowerCase(), 10);
  await query('UPDATE users SET security_question = $1, security_answer_hash = $2 WHERE id = $3', [q, hash, userId]);
};

const verifySecurityAnswer = async (userId, answerPlain) => {
  const res = await query('SELECT security_answer_hash FROM users WHERE id = $1', [userId]);
  const row = res.rows[0];
  if (!row?.security_answer_hash) return false;
  return bcrypt.compare(String(answerPlain || '').trim().toLowerCase(), row.security_answer_hash);
};

const hasSecurityQuestion = async (userId) => {
  const res = await query(
    'SELECT security_answer_hash FROM users WHERE id = $1',
    [userId]
  );
  return !!(res.rows[0]?.security_answer_hash);
};

const updatePrivacyMaskCaller = async (userId, enabled) => {
  const res = await query('UPDATE users SET privacy_mask_caller = $1 WHERE id = $2 RETURNING id', [!!enabled, userId]);
  return res.rowCount > 0;
};

/** Permanent account removal — DB cascades related rows. */
const deleteUserPermanently = async (userId) => {
  const res = await query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
  return res.rowCount > 0;
};

module.exports = {
  findByUsername,
  findByUid,
  findById,
  findByUsernameOrEmail,
  findByMobile,
  findByUsernameOrMobile,
  create,
  comparePassword,
  updateProfile,
  updateLastSeen,
  deactivateUser,
  updatePassword,
  updateNotificationsEnabled,
  getNotificationsEnabled,
  updateReadReceiptsEnabled,
  getReadReceiptsEnabled,
  setSecurityQuestion,
  verifySecurityAnswer,
  hasSecurityQuestion,
  updatePrivacyMaskCaller,
  deleteUserPermanently,
};
