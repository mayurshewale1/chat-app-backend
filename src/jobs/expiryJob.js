const { removeExpiredMessages } = require('../services/messageExpiry');

// Simple interval-based expiry (runs when server starts)
const runExpiryJob = async () => {
  await removeExpiredMessages();
};

// Run every hour
setInterval(runExpiryJob, 60 * 60 * 1000);

module.exports = { runExpiryJob };
