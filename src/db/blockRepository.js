const { query } = require('../config/db');

const block = async (blockerId, blockedId) => {
  const res = await query(
    `INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)
     ON CONFLICT (blocker_id, blocked_id) DO NOTHING
     RETURNING *`,
    [blockerId, blockedId]
  );
  return res.rows[0] || null;
};

const unblock = async (blockerId, blockedId) => {
  const res = await query(
    'DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2 RETURNING id',
    [blockerId, blockedId]
  );
  return res.rowCount > 0;
};

const isBlocked = async (blockerId, blockedId) => {
  const res = await query(
    'SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
    [blockerId, blockedId]
  );
  return res.rows.length > 0;
};

const listBlocked = async (blockerId) => {
  const res = await query(
    `SELECT u.id, u.uid, u.username, u.display_name, u.avatar
     FROM blocks b
     JOIN users u ON u.id = b.blocked_id
     WHERE b.blocker_id = $1
     ORDER BY b.created_at DESC`,
    [blockerId]
  );
  return res.rows;
};

module.exports = { block, unblock, isBlocked, listBlocked };
