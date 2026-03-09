const { query } = require('../config/db');

const recordDeletion = async (userId, chatId) => {
  await query(
    `INSERT INTO deleted_chats (user_id, chat_id, deleted_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, chat_id) DO UPDATE SET deleted_at = NOW()`,
    [userId, chatId]
  );
};

const isDeletedByUser = async (userId, chatId) => {
  const res = await query(
    'SELECT 1 FROM deleted_chats WHERE user_id = $1 AND chat_id = $2',
    [userId, chatId]
  );
  return res.rows.length > 0;
};

/**
 * Get chat IDs that should be purged: all members have deleted and earliest deletion is > 7 days ago.
 */
const getChatsToPurge = async () => {
  const res = await query(
    `SELECT dc.chat_id
     FROM deleted_chats dc
     JOIN chat_members cm ON cm.chat_id = dc.chat_id
     GROUP BY dc.chat_id
     HAVING COUNT(DISTINCT dc.user_id) = COUNT(DISTINCT cm.user_id)
        AND MIN(dc.deleted_at) < NOW() - INTERVAL '7 days'`
  );
  return res.rows.map((r) => r.chat_id);
};

module.exports = {
  recordDeletion,
  isDeletedByUser,
  getChatsToPurge,
};
