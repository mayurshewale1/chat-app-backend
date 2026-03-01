const { query, getPool } = require('../config/db');

const findById = async (id) => {
  const res = await query('SELECT * FROM chats WHERE id = $1', [id]);
  return res.rows[0] || null;
};

const getMembers = async (chatId) => {
  const res = await query(
    `SELECT u.id, u.uid, u.username, u.display_name, u.avatar, u.last_seen
     FROM chat_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.chat_id = $1`,
    [chatId]
  );
  return res.rows;
};

const getChatPartnerIds = async (userId) => {
  const res = await query(
    `SELECT DISTINCT cm2.user_id
     FROM chat_members cm1
     JOIN chat_members cm2 ON cm2.chat_id = cm1.chat_id AND cm2.user_id != cm1.user_id
     WHERE cm1.user_id = $1`,
    [userId]
  );
  return res.rows.map((r) => r.user_id);
};

const findByMember = async (userId) => {
  const res = await query(
    `SELECT c.* FROM chats c
     JOIN chat_members cm ON cm.chat_id = c.id
     WHERE cm.user_id = $1
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return res.rows;
};

const findByMembers = async (userIdA, userIdB) => {
  const res = await query(
    `SELECT c.* FROM chats c
     JOIN chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = $1
     JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = $2`,
    [userIdA, userIdB]
  );
  return res.rows[0] || null;
};

const create = async (memberIds) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      'INSERT INTO chats (last_message) VALUES (NULL) RETURNING *',
      []
    );
    const chat = res.rows[0];
    for (const userId of memberIds) {
      await client.query('INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2)', [chat.id, userId]);
    }
    await client.query('COMMIT');
    return chat;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const updateLastMessage = async (chatId, lastMessage) => {
  await query('UPDATE chats SET last_message = $1 WHERE id = $2', [lastMessage, chatId]);
};

const deleteById = async (chatId) => {
  await query('DELETE FROM chats WHERE id = $1', [chatId]);
};

module.exports = {
  findById,
  getMembers,
  findByMember,
  findByMembers,
  create,
  updateLastMessage,
  deleteById,
  getChatPartnerIds,
};
