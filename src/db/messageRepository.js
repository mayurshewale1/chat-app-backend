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

/** Last message excluding those "deleted for" user (e.g. viewOnce after viewing). Matches what user sees in chat. */
const getLastMessageForUser = async (chatId, userId) => {
  const res = await query(
    `SELECT m.* FROM messages m
     WHERE m.chat_id = $1
     AND NOT EXISTS (SELECT 1 FROM message_deleted_for d WHERE d.message_id = m.id AND d.user_id = $2)
     ORDER BY m.created_at DESC LIMIT 1`,
    [chatId, userId]
  );
  return res.rows[0] || null;
};

const countUnreadForUser = async (chatId, userId) => {
  const res = await query(
    `SELECT COUNT(*)::int AS count FROM messages m
     WHERE m.chat_id = $1 AND m.to_user_id = $2 AND m.status != 'read'
     AND NOT EXISTS (SELECT 1 FROM message_deleted_for d WHERE d.message_id = m.id AND d.user_id = $2)`,
    [chatId, userId]
  );
  return res.rows[0]?.count ?? 0;
};

const create = async ({ chatId, fromUserId, toUserId, content, type, ephemeral, expireAt, isSaved, replyTo, duration }) => {
  const res = await query(
    `INSERT INTO messages (chat_id, from_user_id, to_user_id, content, type, ephemeral_mode, expire_at, is_saved, reply_to_message_id, reply_to_text, reply_to_sender, reply_to_type, duration)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, false), $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      chatId,
      fromUserId,
      toUserId,
      content || null,
      type || 'text',
      ephemeral?.mode || null,
      expireAt || null,
      !!isSaved,
      replyTo?.messageId || null,
      replyTo?.text || null,
      replyTo?.sender !== undefined ? replyTo.sender : null,
      replyTo?.type || null,
      duration || null,
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

const setFirstSeenAtIfNull = async (id) => {
  await query(
    `UPDATE messages SET first_seen_at = COALESCE(first_seen_at, NOW()) WHERE id = $1`,
    [id]
  );
};

/** Sets first_seen_at, expire_at = first_seen + durationMs, status read. */
const setSeenAndExpireAfter = async (id, durationMs) => {
  await query(
    `UPDATE messages SET first_seen_at = COALESCE(first_seen_at, NOW()) WHERE id = $1`,
    [id]
  );
  const cur = await query(`SELECT first_seen_at FROM messages WHERE id = $1`, [id]);
  const fs = cur.rows[0]?.first_seen_at;
  if (!fs) return null;
  const expireAt = new Date(new Date(fs).getTime() + durationMs);
  const res = await query(
    `UPDATE messages SET expire_at = $2, status = 'read' WHERE id = $1 RETURNING *`,
    [id, expireAt.toISOString()]
  );
  return res.rows[0] || null;
};

const setSaved = async (id, saved) => {
  const res = await query('UPDATE messages SET is_saved = $2 WHERE id = $1 RETURNING *', [id, !!saved]);
  return res.rows[0] || null;
};

const deleteById = async (id) => {
  await query('DELETE FROM messages WHERE id = $1', [id]);
};

/** Hide message only for this user (still exists for the other party). */
const markDeletedForMe = async (userId, messageId) => {
  await query(
    `INSERT INTO message_deleted_for (user_id, message_id) VALUES ($1, $2)
     ON CONFLICT (user_id, message_id) DO NOTHING`,
    [userId, messageId]
  );
};

/** Soft-delete for all participants: strip content, flag row (WhatsApp-style). */
const markDeletedForEveryone = async (id) => {
  const res = await query(
    `UPDATE messages SET deleted_for_everyone = true, content = NULL, type = 'text'
     WHERE id = $1 RETURNING *`,
    [id]
  );
  return res.rows[0] || null;
};

const deleteByChatId = async (chatId) => {
  await query('DELETE FROM messages WHERE chat_id = $1', [chatId]);
};

const deleteExpired = async () => {
  const res = await query(
    `DELETE FROM messages
     WHERE expire_at IS NOT NULL AND expire_at <= NOW()
     RETURNING id, chat_id, from_user_id, to_user_id`
  );
  return res.rows;
};

const deleteViewedViewOnceMessages = async (chatId, userId) => {
  await query(
    `DELETE FROM messages 
     WHERE chat_id = $1 
     AND ephemeral_mode = 'viewOnce' 
     AND to_user_id = $2 
     AND first_seen_at IS NOT NULL`,
    [chatId, userId]
  );
};

/** Chats where message content contains search substring (user's visible messages only) */
const searchChatIdsByContent = async (userId, searchText) => {
  const raw = searchText && String(searchText).trim();
  if (!raw) return [];
  const res = await query(
    `SELECT DISTINCT m.chat_id
     FROM messages m
     JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = $1
     WHERE m.content IS NOT NULL
     AND COALESCE(m.deleted_for_everyone, false) = false
     AND strpos(lower(m.content), lower($2::text)) > 0
     AND NOT EXISTS (
       SELECT 1 FROM message_deleted_for d
       WHERE d.message_id = m.id AND d.user_id = $1
     )`,
    [userId, raw]
  );
  return res.rows.map((r) => r.chat_id);
};

module.exports = {
  create,
  findById,
  findByChat,
  updateStatus,
  setSeenAndExpireAfter,
  setFirstSeenAtIfNull,
  countUnreadForUser,
  getLastMessageForUser,
  getLastMessage,
  deleteByChatId,
  deleteExpired,
  deleteViewedViewOnceMessages,
  markDeletedForUserInChat,
  markDeletedForEveryone,
  searchChatIdsByContent,
};
