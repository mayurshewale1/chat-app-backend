const { removeExpiredMessages } = require('../services/messageExpiry');
const { purgeDeletedChats } = require('../services/purgeDeletedChats');

const runExpiryJob = async () => {
  await removeExpiredMessages();
};

const runPurgeJob = async () => {
  await purgeDeletedChats();
};

// 24h / timed ephemeral: check every minute
setInterval(runExpiryJob, 60 * 1000);

// Purge soft-deleted chats less often
setInterval(runPurgeJob, 60 * 60 * 1000);

setTimeout(() => {
  runExpiryJob();
  runPurgeJob();
}, 5000);

module.exports = { runExpiryJob, runPurgeJob };
