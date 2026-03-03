const { query } = require('../config/db');

const create = async ({ callerId, calleeId, callType, status = 'ringing' }) => {
  const res = await query(
    `INSERT INTO call_history (caller_id, callee_id, call_type, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [callerId, calleeId, callType, status]
  );
  return res.rows[0];
};

const updateStatus = async (id, status) => {
  const res = await query(
    'UPDATE call_history SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  return res.rows[0];
};

const findLatestRinging = async (callerId, calleeId) => {
  const res = await query(
    `SELECT * FROM call_history
     WHERE caller_id = $1 AND callee_id = $2 AND status = 'ringing'
     ORDER BY created_at DESC LIMIT 1`,
    [callerId, calleeId]
  );
  return res.rows[0] || null;
};

const findLatestRingingBetween = async (userId1, userId2) => {
  const res = await query(
    `SELECT * FROM call_history
     WHERE ((caller_id = $1 AND callee_id = $2) OR (caller_id = $2 AND callee_id = $1))
     AND status = 'ringing'
     ORDER BY created_at DESC LIMIT 1`,
    [userId1, userId2]
  );
  return res.rows[0] || null;
};

const deleteByIdForUser = async (id, userId) => {
  const res = await query(
    `DELETE FROM call_history
     WHERE id = $1 AND (caller_id = $2 OR callee_id = $2)
     RETURNING id`,
    [id, userId]
  );
  return res.rows[0] || null;
};

const listByUserId = async (userId) => {
  const res = await query(
    `SELECT ch.id, ch.caller_id, ch.callee_id, ch.call_type, ch.status, ch.created_at,
            u_caller.id as caller_user_id, u_caller.username as caller_username, u_caller.display_name as caller_display_name, u_caller.avatar as caller_avatar,
            u_callee.id as callee_user_id, u_callee.username as callee_username, u_callee.display_name as callee_display_name, u_callee.avatar as callee_avatar
     FROM call_history ch
     JOIN users u_caller ON ch.caller_id = u_caller.id
     JOIN users u_callee ON ch.callee_id = u_callee.id
     WHERE ch.caller_id = $1 OR ch.callee_id = $1
     ORDER BY ch.created_at DESC
     LIMIT 100`,
    [userId]
  );
  return res.rows;
};

module.exports = {
  create,
  updateStatus,
  findLatestRinging,
  findLatestRingingBetween,
  listByUserId,
  deleteByIdForUser,
};
