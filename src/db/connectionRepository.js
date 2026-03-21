const { query } = require('../config/db');

const findById = async (id) => {
  const res = await query('SELECT * FROM connections WHERE id = $1', [id]);
  return res.rows[0] || null;
};

const findByFromTo = async (fromUserId, toUserId) => {
  const res = await query(
    'SELECT * FROM connections WHERE from_user_id = $1 AND to_user_id = $2',
    [fromUserId, toUserId]
  );
  return res.rows[0] || null;
};

const create = async (fromUserId, toUserId) => {
  const res = await query(
    `INSERT INTO connections (from_user_id, to_user_id, status)
     VALUES ($1, $2, 'pending')
     RETURNING *`,
    [fromUserId, toUserId]
  );
  return res.rows[0];
};

const updateStatus = async (id, status) => {
  const res = await query(
    'UPDATE connections SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  return res.rows[0] || null;
};

const listAcceptedConnections = async (userId) => {
  const res = await query(
    `SELECT u.id, u.uid, u.username, u.display_name, u.avatar
     FROM users u
     WHERE u.id IN (
       SELECT from_user_id FROM connections WHERE to_user_id = $1 AND status = 'accepted'
       UNION
       SELECT to_user_id FROM connections WHERE from_user_id = $1 AND status = 'accepted'
     )`,
    [userId]
  );
  return res.rows;
};

const listPendingRequestsReceived = async (userId) => {
  const res = await query(
    `SELECT c.id, c.from_user_id, c.to_user_id, c.created_at,
            u.uid, u.username, u.display_name, u.avatar
     FROM connections c
     JOIN users u ON u.id = c.from_user_id
     WHERE c.to_user_id = $1 AND c.status = 'pending'
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return res.rows;
};

const listPendingRequestsSent = async (userId) => {
  const res = await query(
    `SELECT c.id, c.from_user_id, c.to_user_id, c.created_at,
            u.uid, u.username, u.display_name, u.avatar
     FROM connections c
     JOIN users u ON u.id = c.to_user_id
     WHERE c.from_user_id = $1 AND c.status = 'pending'
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return res.rows;
};

const removeBetweenUsers = async (userId, otherUserId) => {
  const res = await query(
    `DELETE FROM connections
     WHERE ((from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1))
     AND status = 'accepted'
     RETURNING id`,
    [userId, otherUserId]
  );
  return res.rowCount > 0;
};

const listHistoryReceived = async (userId) => {
  const res = await query(
    `SELECT c.id, c.from_user_id, c.to_user_id, c.status, c.created_at,
            u.uid, u.username, u.display_name, u.avatar
     FROM connections c
     JOIN users u ON u.id = c.from_user_id
     WHERE c.to_user_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM connection_history_hidden h
         WHERE h.user_id = $1 AND h.connection_id = c.id
       )
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return res.rows;
};

const listHistorySent = async (userId) => {
  const res = await query(
    `SELECT c.id, c.from_user_id, c.to_user_id, c.status, c.created_at,
            u.uid, u.username, u.display_name, u.avatar
     FROM connections c
     JOIN users u ON u.id = c.to_user_id
     WHERE c.from_user_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM connection_history_hidden h
         WHERE h.user_id = $1 AND h.connection_id = c.id
       )
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return res.rows;
};

const hideFromHistory = async (userId, connectionId) => {
  const res = await query(
    `INSERT INTO connection_history_hidden (user_id, connection_id) VALUES ($1, $2)
     ON CONFLICT (user_id, connection_id) DO NOTHING
     RETURNING connection_id`,
    [userId, connectionId]
  );
  return res.rowCount > 0;
};

/** Delete row if pending/rejected; caller must authorize. */
const deleteByIdIfNotAccepted = async (connectionId, userId) => {
  const res = await query(
    `DELETE FROM connections
     WHERE id = $1 AND status IN ('pending', 'rejected')
       AND (from_user_id = $2 OR to_user_id = $2)
     RETURNING id`,
    [connectionId, userId]
  );
  return res.rowCount > 0;
};

module.exports = {
  findById,
  findByFromTo,
  create,
  updateStatus,
  listAcceptedConnections,
  listPendingRequestsReceived,
  listPendingRequestsSent,
  removeBetweenUsers,
  listHistoryReceived,
  listHistorySent,
  hideFromHistory,
  deleteByIdIfNotAccepted,
};
