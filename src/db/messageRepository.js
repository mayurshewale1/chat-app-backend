const { query } = require('../config/db');

const findById = async (id) => {
  const res = await query('SELECT * FROM messages WHERE id = $1', [id]);
  return res.rows[0] || null;
};

const findByChat = async (chatId, { limit = 50, before } = {}) => {
  let sql = 'SELECT * FROM messages WHERE chat_id = $1';
  const params = [chatId];

  if (before) {
    const date = new Date(before);
    if (!isNaN(date.getTime())) {
      sql += ' AND created_at < $2 ORDER BY created_at DESC LIMIT $3';
      params.push(date.toISOString(), limit);
    } else {
      sql += ' AND id < $2::uuid ORDER BY created_at DESC LIMIT $3';
      params.push(before, limit);
    }
  } else {
    sql += ' ORDER BY created_at DESC LIMIT $2';
    params.push(limit);
  }

  const res = await query(sql, params);
  return res.rows.reverse();
};

const getLastMessage = async (chatId) => {
  const res = await query(
    'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 1',
    [chatId]
  );
  return res.rows[0] || null;
};

const create = async ({ chatId, fromUserId, toUserId, content, type, ephemeral, expireAt }) => {
  const res = await query(
    `INSERT INTO messages (chat_id, from_user_id, to_user_id, content, type, ephemeral_mode, expire_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      chatId,
      fromUserId,
      toUserId,
      content || null,
      type || 'text',
      ephemeral?.mode || null,
      expireAt || null,
    ]
  );
  return res.rows[0];
};

const updateStatus = async (id, status) => {
  const res = await query(
    'UPDATE messages SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  return res.rows[0] || null;
};

const deleteById = async (id) => {
  await query('DELETE FROM messages WHERE id = $1', [id]);
};

const deleteByChatId = async (chatId) => {
  await query('DELETE FROM messages WHERE chat_id = $1', [chatId]);
};

const deleteExpired = async () => {
  await query('DELETE FROM messages WHERE expire_at IS NOT NULL AND expire_at <= NOW()');
};

const deleteByEphemeralMode = async (mode, toUserId) => {
  await query(
    'DELETE FROM messages WHERE ephemeral_mode = $1 AND to_user_id = $2',
    [mode, toUserId]
  );
};

module.exports = {
  findById,
  findByChat,
  getLastMessage,
  create,
  updateStatus,
  deleteById,
  deleteByChatId,
  deleteExpired,
  deleteByEphemeralMode,
};
