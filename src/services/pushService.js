/**
 * Push notification service via Firebase Cloud Messaging.
 * Requires firebase-service-account.json in backend root.
 * If not configured, sends are no-ops (no crash).
 */
const path = require('path');
const logger = require('../utils/logger');

let admin = null;
let initialized = false;

function init() {
  if (initialized) return !!admin;
  try {
    const credPath = path.resolve(process.cwd(), 'firebase-service-account.json');
    const fs = require('fs');
    if (!fs.existsSync(credPath)) {
      logger.warn('Push: firebase-service-account.json not found. Push notifications disabled.');
      initialized = true;
      return false;
    }
    admin = require('firebase-admin');
    const cred = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(cred) });
    initialized = true;
    logger.info('Push: Firebase Admin initialized');
    return true;
  } catch (err) {
    logger.warn('Push: init failed', err.message);
    initialized = true;
    return false;
  }
}

async function sendToUser(userId, { title, body, data = {} }) {
  const deviceTokenRepo = require('../db/deviceTokenRepository');
  const tokens = await deviceTokenRepo.findByUserId(userId);
  if (!tokens || tokens.length === 0) return;
  if (!admin && !init()) return;

  const messages = tokens.map((t) => ({
    token: t.fcm_token,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: {
      priority: 'high',
      notification: { channelId: 'default', sound: 'default' },
    },
    apns: {
      payload: { aps: { sound: 'default' } },
      fcmOptions: {},
    },
  }));

  try {
    const res = await admin.messaging().sendEach(messages);
    if (res.failureCount > 0) {
      res.responses.forEach((r, i) => {
        if (!r.success) logger.warn('Push send failed', r.error?.message, tokens[i]?.fcm_token?.slice(0, 20));
      });
    }
  } catch (err) {
    logger.error('Push send error', err.message);
  }
}

async function notifyNewMessage({ toUserId, fromUserId, fromName, chatId, preview }) {
  await sendToUser(toUserId, {
    title: fromName || 'New message',
    body: preview || 'You have a new message',
    data: {
      type: 'message',
      chatId: String(chatId),
      fromUserId: fromUserId ? String(fromUserId) : '',
      fromName: fromName || '',
    },
  });
}

async function notifyFriendRequest({ toUserId, fromName, requestId }) {
  await sendToUser(toUserId, {
    title: 'Friend Request',
    body: `${fromName || 'Someone'} wants to connect`,
    data: { type: 'friend_request', requestId: String(requestId) },
  });
}

async function notifyIncomingCall({ toUserId, fromName, isVideo }) {
  await sendToUser(toUserId, {
    title: 'Incoming Call',
    body: `${fromName || 'Someone'} is ${isVideo ? 'video' : 'voice'} calling...`,
    data: { type: 'call', isVideo: isVideo ? 'true' : 'false' },
  });
}

module.exports = {
  init,
  sendToUser,
  notifyNewMessage,
  notifyFriendRequest,
  notifyIncomingCall,
};
