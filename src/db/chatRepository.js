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

/** Recent chats first: by latest message time (excluding messages hidden for user), else chat created_at */
const findByMemberPaginated = async (userId, limit = 50, offset = 0) => {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const res = await query(
    `SELECT c.* FROM chats c
     JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = $1
     ORDER BY COALESCE(
       (SELECT MAX(m.created_at) FROM messages m
        WHERE m.chat_id = c.id
        AND NOT EXISTS (
          SELECT 1 FROM message_deleted_for d
          WHERE d.message_id = m.id AND d.user_id = $1
        )),
       c.created_at
     ) DESC NULLS LAST
     LIMIT $2 OFFSET $3`,
    [userId, lim + 1, off]
  );
  const rows = res.rows;
  const hasMore = rows.length > lim;
  return { chats: hasMore ? rows.slice(0, lim) : rows, hasMore };
};

/** Chat ids where the other member's username/display_name contains search (substring, case-insensitive) */
const findChatIdsByPeerNameMatch = async (userId, searchText) => {
  const raw = searchText && String(searchText).trim();
  if (!raw) return [];
  const res = await query(
    `SELECT DISTINCT c.id
     FROM chats c
     JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = $1
     JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id != $1
     JOIN users u ON u.id = cm2.user_id
     WHERE strpos(lower(u.username), lower($2::text)) > 0
        OR strpos(lower(COALESCE(u.display_name, '')), lower($2::text)) > 0`,
    [userId, raw]
  );
  return res.rows.map((r) => r.id);
};

/** Order a set of chat ids by recent activity for this user */
const findChatsByIdsOrderedForUser = async (userId, ids) => {
  if (!ids || ids.length === 0) return [];
  const res = await query(
    `SELECT c.* FROM chats c
     WHERE c.id = ANY($2::uuid[])
     ORDER BY COALESCE(
       (SELECT MAX(m.created_at) FROM messages m
        WHERE m.chat_id = c.id
        AND NOT EXISTS (
          SELECT 1 FROM message_deleted_for d
          WHERE d.message_id = m.id AND d.user_id = $1
        )),
       c.created_at
     ) DESC NULLS LAST`,
    [userId, ids]
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
  // If duplicate chats exist between the same 2 users, pick the most "active" one.
  // (Without ORDER BY, postgres can return an arbitrary row.)
  // We consider "active" = most recent message time, else chat created time.
  const rows = res.rows;
  if (!rows.length) return null;
  if (rows.length === 1) return rows[0];
  const ids = rows.map((r) => r.id);
  const ranked = await query(
    `SELECT c.id,
      (SELECT MAX(m.created_at) FROM messages m WHERE m.chat_id = c.id) AS last_message_at,
      EXISTS (SELECT 1 FROM messages m WHERE m.chat_id = c.id) AS has_messages
     FROM chats c
     WHERE c.id = ANY($1::uuid[])
     ORDER BY
       has_messages DESC,
       last_message_at DESC NULLS LAST,
       c.created_at DESC NULLS LAST
     LIMIT 1`,
    [ids]
  );
  const bestId = ranked.rows[0]?.id;
  return rows.find((r) => r.id === bestId) || rows[0];
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
  findByMemberPaginated,
  findChatIdsByPeerNameMatch,
  findChatsByIdsOrderedForUser,
  findByMembers,
  create,
  updateLastMessage,
  deleteById,
  getChatPartnerIds,
};
