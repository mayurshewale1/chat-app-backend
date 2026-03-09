const { removeExpiredMessages } = require('../services/messageExpiry');
const { purgeDeletedChats } = require('../services/purgeDeletedChats');

const runExpiryJob = async () => {
  await removeExpiredMessages();
  await purgeDeletedChats();
};

// Run every hour
setInterval(runExpiryJob, 60 * 60 * 1000);

// Run once on startup (after a short delay for DB to be ready)
setTimeout(() => runExpiryJob(), 5000);

module.exports = { runExpiryJob };
