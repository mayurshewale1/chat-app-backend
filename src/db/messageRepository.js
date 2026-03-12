const { query } = require('../config/db');

const findById = async (id) => {
  const res = await query('SELECT * FROM messages WHERE id = $1', [id]);
  return res.rows[0] || null;
};

const findByChat = async (chatId, { limit = 50, before, excludeForUserId } = {}) => {
  const params = [];
  let paramIdx = 1;

  let sql = 'SELECT m.* FROM messages m WHERE m.chat_id = $' + paramIdx++;
  params.push(chatId);

  if (excludeForUserId) {
    sql += ' AND NOT EXISTS (SELECT 1 FROM message_deleted_for d WHERE d.message_id = m.id AND d.user_id = $' + paramIdx + ')';
    params.push(excludeForUserId);
    paramIdx++;
  }

  if (before) {
    const date = new Date(before);
    if (!isNaN(date.getTime())) {
      sql += ' AND m.created_at < $' + paramIdx + ' ORDER BY m.created_at DESC LIMIT $' + (paramIdx + 1);
      params.push(date.toISOString(), limit);
    } else {
      sql += ' AND m.id < $' + paramIdx + '::uuid ORDER BY m.created_at DESC LIMIT $' + (paramIdx + 1);
      params.push(before, limit);
    }
  } else {
    sql += ' ORDER BY m.created_at DESC LIMIT $' + paramIdx;
    params.push(limit);
  }

  const res = await query(sql, params);
  return res.rows.reverse();
};

const markDeletedForUserInChat = async (userId, chatId) => {
  await query(
    `INSERT INTO message_deleted_for (user_id, message_id)
     SELECT $1, id FROM messages
     WHERE chat_id = $2 AND ephemeral_mode = 'viewOnce'
     ON CONFLICT (user_id, message_id) DO NOTHING`,
    [userId, chatId]
  );
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

const setExpireAtAndStatus = async (id, expireAt, status = 'read') => {
  const res = await query(
    'UPDATE messages SET status = $1, expire_at = $2 WHERE id = $3 RETURNING *',
    [status, expireAt, id]
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
  setExpireAtAndStatus,
  deleteById,
  deleteByChatId,
  deleteExpired,
  deleteByEphemeralMode,
  markDeletedForUserInChat,
};
