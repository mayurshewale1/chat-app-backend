const jwt = require('jsonwebtoken');
const config = require('../config');
const userRepo = require('../db/userRepository');
const messageRepo = require('../db/messageRepository');
const callHistoryRepo = require('../db/callHistoryRepository');
const chatRepo = require('../db/chatRepository');
const logger = require('../utils/logger');

const socketCountByUser = new Map();
const activeCallPeers = new Map();
const SOCKET_RATE_LIMIT = { windowMs: 60000, maxPerWindow: 120 };
const socketEventCounts = new Map();

const toMessageResponse = (row) => ({
  id: row.id,
  _id: row.id,
  chat: row.chat_id,
  from: row.from_user_id,
  to: row.to_user_id,
  content: row.content,
  type: row.type,
  status: row.status,
  ephemeral: row.ephemeral_mode ? { mode: row.ephemeral_mode } : null,
  expireAt: row.expire_at,
  createdAt: row.created_at,
});

function isOnline(userId) {
  return (socketCountByUser.get(userId) || 0) > 0;
}

function socketRateLimit(socketId) {
  const now = Date.now();
  let data = socketEventCounts.get(socketId);
  if (!data) {
    data = { count: 0, windowStart: now };
    socketEventCounts.set(socketId, data);
  }
  if (now - data.windowStart > SOCKET_RATE_LIMIT.windowMs) {
    data.count = 0;
    data.windowStart = now;
  }
  data.count++;
  if (data.count > SOCKET_RATE_LIMIT.maxPerWindow) {
    return false;
  }
  return true;
}

function clearCallPeers(userId) {
  const peers = activeCallPeers.get(userId);
  if (peers) {
    peers.forEach((peerId) => {
      const peerSet = activeCallPeers.get(peerId);
      if (peerSet) {
        peerSet.delete(userId);
        if (peerSet.size === 0) activeCallPeers.delete(peerId);
      }
    });
    activeCallPeers.delete(userId);
    return peers;
  }
  return null;
}

function initSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers['authorization']?.toString().split(' ')[1];
      if (!token) return next(new Error('Authentication error'));
      const decoded = jwt.verify(token, config.JWT_SECRET);
      const user = await userRepo.findById(decoded.sub);
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    socket.join(`user:${user.id}`);
    socketCountByUser.set(user.id, (socketCountByUser.get(user.id) || 0) + 1);
    userRepo.updateLastSeen(user.id).catch(() => {});

    chatRepo.getChatPartnerIds(user.id).then((partnerIds) => {
      partnerIds.forEach((pid) => io.to(`user:${pid}`).emit('presence:status', { userId: user.id, online: true }));
    }).catch(() => {});

    socket.on('message:send', async (payload, cb) => {
      if (!socketRateLimit(socket.id)) {
        return cb && cb({ success: false, error: 'Rate limit exceeded' });
      }
      try {
        let expireAt = null;
        if (payload.ephemeral?.mode === '24h') {
          expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        } else if (payload.ephemeral?.mode === '7d') {
          expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }

        const message = await messageRepo.create({
          chatId: payload.chatId,
          fromUserId: user.id,
          toUserId: payload.to,
          content: payload.content,
          type: payload.type || 'text',
          ephemeral: payload.ephemeral || null,
          expireAt,
        });

        const lastMsgDisplay = payload.type === 'media' ? '📷 Photo' : payload.content;
        await chatRepo.updateLastMessage(payload.chatId, lastMsgDisplay);

        io.to(`user:${payload.to}`).emit('message:new', toMessageResponse(message));

        cb && cb({ success: true, message: 'Sent', id: message.id });
      } catch (err) {
        logger.error('message:send error', err);
        cb && cb({ success: false, error: 'Failed to send' });
      }
    });

    socket.on('message:delivered', async ({ messageId }) => {
      try {
        const m = await messageRepo.updateStatus(messageId, 'delivered');
        if (m) io.to(`user:${m.from_user_id}`).emit('message:status', { messageId: m.id, status: 'delivered' });
      } catch (err) {
        logger.warn(err);
      }
    });

    socket.on('message:delete', async ({ chatId, messageId }, cb) => {
      try {
        const m = await messageRepo.findById(messageId);
        if (!m) return cb && cb({ success: false, error: 'Message not found' });
        if (m.from_user_id !== user.id) return cb && cb({ success: false, error: 'Not authorized' });
        if (m.chat_id !== chatId) return cb && cb({ success: false, error: 'Invalid chat' });

        await messageRepo.deleteById(messageId);
        io.to(`user:${m.from_user_id}`).emit('message:deleted', { chatId, messageId });
        io.to(`user:${m.to_user_id}`).emit('message:deleted', { chatId, messageId });
        cb && cb({ success: true });
      } catch (err) {
        logger.warn('message:delete error', err);
        cb && cb({ success: false, error: 'Failed to delete' });
      }
    });

    socket.on('message:read', async ({ messageId }) => {
      try {
        const m = await messageRepo.findById(messageId);
        if (!m) return;
        if (m.ephemeral_mode === 'viewOnce') {
          await messageRepo.deleteById(messageId);
          io.to(`user:${m.from_user_id}`).emit('message:status', { messageId, status: 'viewed_and_deleted' });
        } else {
          await messageRepo.updateStatus(messageId, 'read');
          io.to(`user:${m.from_user_id}`).emit('message:status', { messageId, status: 'read' });
        }
      } catch (err) {
        logger.warn(err);
      }
    });

    socket.on('call:offer', async ({ to, offer, isVideo }) => {
      if (!socketRateLimit(socket.id)) return;
      try {
        await callHistoryRepo.create({
          callerId: user.id,
          calleeId: to,
          callType: isVideo ? 'video' : 'voice',
          status: 'ringing',
        });
        const caller = await userRepo.findById(user.id);
        const callerInfo = caller
          ? { id: caller.id, username: caller.username, displayName: caller.display_name, avatar: caller.avatar || '👤' }
          : null;
        io.to(`user:${to}`).emit('call:incoming', {
          from: user.id,
          offer,
          isVideo: !!isVideo,
          caller: callerInfo,
        });
      } catch (err) {
        logger.warn('call:offer error', err);
        io.to(`user:${to}`).emit('call:incoming', { from: user.id, offer, isVideo: !!isVideo });
      }
    });

    socket.on('call:answer', async ({ to, answer }) => {
      try {
        const rec = await callHistoryRepo.findLatestRinging(to, user.id);
        if (rec) await callHistoryRepo.updateStatus(rec.id, 'completed');
        const callerId = to;
        const calleeId = user.id;
        if (!activeCallPeers.has(callerId)) activeCallPeers.set(callerId, new Set());
        if (!activeCallPeers.has(calleeId)) activeCallPeers.set(calleeId, new Set());
        activeCallPeers.get(callerId).add(calleeId);
        activeCallPeers.get(calleeId).add(callerId);
      } catch (err) {
        logger.warn('call:answer history update', err);
      }
      io.to(`user:${to}`).emit('call:answer', { from: user.id, answer });
    });

    socket.on('call:ice-candidate', ({ to, candidate }) => {
      io.to(`user:${to}`).emit('call:ice-candidate', { from: user.id, candidate });
    });

    socket.on('call:hangup', async ({ to }) => {
      try {
        if (to) {
          const rec = await callHistoryRepo.findLatestRingingBetween(user.id, to);
          if (rec) await callHistoryRepo.updateStatus(rec.id, 'cancelled');
          const peerSet = activeCallPeers.get(user.id);
          if (peerSet) {
            peerSet.delete(to);
            if (peerSet.size === 0) activeCallPeers.delete(user.id);
          }
          const toSet = activeCallPeers.get(to);
          if (toSet) {
            toSet.delete(user.id);
            if (toSet.size === 0) activeCallPeers.delete(to);
          }
        }
      } catch (err) {
        logger.warn('call:hangup history update', err);
      }
      if (to) io.to(`user:${to}`).emit('call:hangup', { from: user.id });
    });

    socket.on('call:reject', async ({ to }) => {
      try {
        if (to) {
          const rec = await callHistoryRepo.findLatestRinging(user.id, to);
          if (rec) await callHistoryRepo.updateStatus(rec.id, 'rejected');
          const peerSet = activeCallPeers.get(to);
          if (peerSet) {
            peerSet.delete(user.id);
            if (peerSet.size === 0) activeCallPeers.delete(to);
          }
        }
      } catch (err) {
        logger.warn('call:reject history update', err);
      }
      if (to) io.to(`user:${to}`).emit('call:rejected', { from: user.id });
    });

    socket.on('presence:request', async ({ userId }) => {
      try {
        const online = isOnline(userId);
        const u = await userRepo.findById(userId);
        socket.emit('presence:response', { userId, online, lastSeen: u?.last_seen || null });
      } catch (err) {
        socket.emit('presence:response', { userId, online: false, lastSeen: null });
      }
    });

    socket.on('typing:start', ({ to }) => {
      if (to) io.to(`user:${to}`).emit('typing:status', { from: user.id, typing: true });
    });

    socket.on('typing:stop', ({ to }) => {
      if (to) io.to(`user:${to}`).emit('typing:status', { from: user.id, typing: false });
    });

    socket.on('disconnect', async () => {
      const count = (socketCountByUser.get(user.id) || 1) - 1;
      socketCountByUser.set(user.id, count);
      if (count <= 0) socketCountByUser.delete(user.id);

      const peers = clearCallPeers(user.id);
      if (peers) {
        peers.forEach((peerId) => io.to(`user:${peerId}`).emit('call:hangup', { from: user.id }));
      }

      socketEventCounts.delete(socket.id);

      userRepo.updateLastSeen(user.id).catch(() => {});
      const wasLastSocket = count <= 0;
      if (wasLastSocket) {
        try {
          const partnerIds = await chatRepo.getChatPartnerIds(user.id);
          partnerIds.forEach((pid) => io.to(`user:${pid}`).emit('presence:status', { userId: user.id, online: false, lastSeen: new Date().toISOString() }));
        } catch (err) {
          logger.warn('presence broadcast on disconnect failed', err);
        }
      }
      try {
        await messageRepo.deleteByEphemeralMode('deleteOnExit', user.id);
      } catch (err) {
        logger.warn('cleanup on disconnect failed', err);
      }
    });
  });
}

module.exports = initSockets;
