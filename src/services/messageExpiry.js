const messageRepo = require('../db/messageRepository');
const { getIo } = require('../ioHolder');
const { refreshChatLastMessage } = require('./ephemeralMessageService');

const removeExpiredMessages = async () => {
  try {
    const rows = await messageRepo.deleteExpired();
    const io = getIo();
    for (const r of rows) {
      await refreshChatLastMessage(r.chat_id);
      if (io) {
        const payload = {
          chatId: r.chat_id,
          messageId: r.id,
          scope: 'ephemeral_expired',
        };
        io.to(`user:${r.from_user_id}`).emit('message:deleted', payload);
        io.to(`user:${r.to_user_id}`).emit('message:deleted', payload);
      }
    }
  } catch (err) {
    console.error('Failed to remove expired messages', err);
  }
};

module.exports = { removeExpiredMessages };
