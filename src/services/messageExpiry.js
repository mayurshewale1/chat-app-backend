const messageRepo = require('../db/messageRepository');

const removeExpiredMessages = async () => {
  try {
    await messageRepo.deleteExpired();
  } catch (err) {
    console.error('Failed to remove expired messages', err);
  }
};

module.exports = { removeExpiredMessages };
