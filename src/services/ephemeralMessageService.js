const messageRepo = require('../db/messageRepository');
const chatRepo = require('../db/chatRepository');
const userRepo = require('../db/userRepository');
const { toMessageResponse } = require('../utils/messageResponse');
const { getIo } = require('../ioHolder');

function previewFromMessage(row) {
  if (!row) return null;
  if (row.deleted_for_everyone) return 'This message was deleted';
  if (row.type === 'media') return '📷 Photo';
  return row.content || null;
}

async function refreshChatLastMessage(chatId) {
  const last = await messageRepo.getLastMessage(chatId);
  await chatRepo.updateLastMessage(chatId, previewFromMessage(last));
}

/**
 * Recipient opened / read a message. Handles view-once delete, 24h/7d expiry, saved flag.
 */
async function processRecipientRead(readerUserId, messageId) {
  const m = await messageRepo.findById(messageId);
  if (!m) return { ok: false, reason: 'not_found' };
  if (m.to_user_id !== readerUserId) return { ok: false, reason: 'not_recipient' };
  if (m.deleted_for_everyone) return { ok: false, reason: 'gone' };

  const receiptsEnabled = await userRepo.getReadReceiptsEnabled(readerUserId);
  const statusForSender = receiptsEnabled ? 'read' : 'delivered';

  if (m.status === 'read' && m.ephemeral_mode !== 'viewOnce') {
    return { ok: true, noop: true };
  }

  if (m.is_saved) {
    await messageRepo.setFirstSeenAtIfNull(messageId);
    await messageRepo.updateStatus(messageId, 'read');
    const updated = await messageRepo.findById(messageId);
    return {
      ok: true,
      noop: false,
      saved: true,
      message: updated,
      messageId: updated.id,
      fromId: m.from_user_id,
      statusForSender,
    };
  }

  if (m.ephemeral_mode === 'viewOnce') {
    const chatId = m.chat_id;
    const fromId = m.from_user_id;
    const toId = m.to_user_id;
    await messageRepo.setFirstSeenAtIfNull(messageId);
    await messageRepo.updateStatus(messageId, 'read');
    await refreshChatLastMessage(chatId);
    return {
      ok: true,
      viewed: true, // Changed from 'deleted' to 'viewed'
      chatId,
      messageId,
      fromId,
      toId,
      statusForSender,
    };
  }

  if (m.ephemeral_mode === '24h') {
    const updated = await messageRepo.setSeenAndExpireAfter(messageId, 24 * 60 * 60 * 1000);
    if (!updated) return { ok: false, reason: 'not_found' };
    return {
      ok: true,
      message: updated,
      messageId: updated.id,
      fromId: m.from_user_id,
      statusForSender,
      emitExpire: true,
    };
  }

  if (m.ephemeral_mode === '7d') {
    const updated = await messageRepo.setSeenAndExpireAfter(messageId, 7 * 24 * 60 * 60 * 1000);
    if (!updated) return { ok: false, reason: 'not_found' };
    return {
      ok: true,
      message: updated,
      messageId: updated.id,
      fromId: m.from_user_id,
      statusForSender,
      emitExpire: true,
    };
  }

  await messageRepo.updateStatus(messageId, 'read');
  return {
    ok: true,
    messageId: m.id,
    fromId: m.from_user_id,
    statusForSender,
  };
}

function emitReadSideEffects(result) {
  const io = getIo();
  if (!io || !result.ok || result.noop) return;

  if (result.viewed) {
    // View Once message was viewed but not deleted yet
    io.to(`user:${result.fromId}`).emit('message:status', {
      messageId: result.messageId,
      status: result.statusForSender,
    });
    
    // Send viewed event to recipient for potential screen exit handling
    io.to(`user:${result.toId}`).emit('message:viewed', {
      messageId: result.messageId,
      chatId: result.chatId,
    });
    return;
  }

  if (result.deleted) {
    io.to(`user:${result.fromId}`).emit('message:status', {
      messageId: result.messageId,
      status: result.statusForSender,
    });
    const payload = {
      chatId: result.chatId,
      messageId: result.messageId,
      scope: 'ephemeral',
    };
    io.to(`user:${result.fromId}`).emit('message:deleted', payload);
    io.to(`user:${result.toId}`).emit('message:deleted', payload);
    return;
  }

  if (result.saved && result.message) {
    io.to(`user:${result.fromId}`).emit('message:status', {
      messageId: result.message.id,
      status: result.statusForSender,
    });
    const formatted = toMessageResponse(result.message);
    io.to(`user:${result.fromId}`).emit('message:updated', { message: formatted });
    io.to(`user:${result.message.to_user_id}`).emit('message:updated', { message: formatted });
    return;
  }

  const fromId = result.fromId || result.message?.from_user_id;
  if (!fromId) return;

  const mid = result.message?.id || result.messageId;
  io.to(`user:${fromId}`).emit('message:status', {
    messageId: mid,
    status: result.statusForSender,
  });

  if (result.emitExpire && result.message) {
    const formatted = toMessageResponse(result.message);
    io.to(`user:${fromId}`).emit('message:updated', { message: formatted });
    const toId = result.message.to_user_id;
    if (toId) io.to(`user:${toId}`).emit('message:updated', { message: formatted });
  }
}

async function processRecipientReadAndEmit(readerUserId, messageId) {
  const result = await processRecipientRead(readerUserId, messageId);
  if (result.ok && !result.noop) {
    emitReadSideEffects(result);
  }
  return result;
}

module.exports = {
  processRecipientRead,
  processRecipientReadAndEmit,
  emitReadSideEffects,
  refreshChatLastMessage,
  previewFromMessage,
};
