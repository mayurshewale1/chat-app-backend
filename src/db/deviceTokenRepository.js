const { query } = require('../config/db');

const upsert = async (userId, fcmToken, platform = null) => {
  await query(
    `INSERT INTO device_tokens (user_id, fcm_token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, fcm_token) DO UPDATE SET platform = EXCLUDED.platform`,
    [userId, fcmToken, platform]
  );
};

const findByUserId = async (userId) => {
  const res = await query(
    'SELECT fcm_token, platform FROM device_tokens WHERE user_id = $1',
    [userId]
  );
  return res.rows;
};

const remove = async (userId, fcmToken) => {
  await query(
    'DELETE FROM device_tokens WHERE user_id = $1 AND fcm_token = $2',
    [userId, fcmToken]
  );
};

module.exports = {
  upsert,
  findByUserId,
  remove,
};
