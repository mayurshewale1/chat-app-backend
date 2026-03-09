const chatRepo = require('../db/chatRepository');
const deletedChatRepo = require('../db/deletedChatRepository');
const logger = require('../utils/logger');

/**
 * Permanently delete chats that have been soft-deleted by all members
 * and the earliest deletion is more than 7 days ago (legal retention period).
 */
const purgeDeletedChats = async () => {
  try {
    const chatIds = await deletedChatRepo.getChatsToPurge();
    for (const chatId of chatIds) {
      await chatRepo.deleteById(chatId);
      logger.info('Purged deleted chat', { chatId });
    }
    if (chatIds.length > 0) {
      logger.info('Purged deleted chats', { count: chatIds.length });
    }
  } catch (err) {
    logger.error('Failed to purge deleted chats', { err: err.message });
  }
};

module.exports = { purgeDeletedChats };
