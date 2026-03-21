const { query } = require('../config/db');

const archive = async (userId, chatId) => {
  await query(
    `INSERT INTO chat_archives (user_id, chat_id) VALUES ($1, $2)
     ON CONFLICT (user_id, chat_id) DO UPDATE SET archived_at = NOW()`,
    [userId, chatId]
  );
};

const unarchive = async (userId, chatId) => {
  const res = await query('DELETE FROM chat_archives WHERE user_id = $1 AND chat_id = $2 RETURNING chat_id', [
    userId,
    chatId,
  ]);
  return res.rowCount > 0;
};

const isArchived = async (userId, chatId) => {
  const res = await query('SELECT 1 FROM chat_archives WHERE user_id = $1 AND chat_id = $2', [userId, chatId]);
  return res.rows.length > 0;
};

module.exports = { archive, unarchive, isArchived };
