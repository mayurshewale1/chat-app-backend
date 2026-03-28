const chatRepo = require('../db/chatRepository');
const messageRepo = require('../db/messageRepository');
const deletedChatRepo = require('../db/deletedChatRepository');
const connectionRepo = require('../db/connectionRepository');
const blockRepo = require('../db/blockRepository');
const userRepo = require('../db/userRepository');
const blockedWords = require('../services/blockedWords');
const { getIo } = require('../ioHolder');
const { getOrCreatePrivateChat } = require('../services/chatService');
const { toMessageResponse, normalizeEphemeralInput } = require('../utils/messageResponse');

async function buildChatListEntry(userId, c) {
  const userDeleted = await deletedChatRepo.isDeletedByUser(userId, c.id);
  if (userDeleted) return null;
  const members = await chatRepo.getMembers(c.id);
  const other = members.find((m) => m.id !== userId);
  if (!other) return null;
  const blockedByMe = await blockRepo.isBlocked(userId, other.id);
  const blockedByYou = await blockRepo.isBlocked(other.id, userId);

  const lastMessage = await messageRepo.getLastMessageForUser(c.id, userId);
  const unreadCount = await messageRepo.countUnreadForUser(c.id, userId);
  return {
    chat: {
      id: c.id,
      _id: c.id,
      members: members.map((m) => ({
        id: m.id,
        uid: m.uid,
        username: m.username,
        displayName: m.display_name,
        avatar: m.avatar || '👤',
      })),
      lastMessage: c.last_message,
      createdAt: c.created_at,
    },
    otherId: other?.id,
    otherUser: other
      ? {
          uid: other.uid,
          username: other.username,
          displayName: other.display_name,
          avatar: other.avatar || '👤',
          lastSeen: other.last_seen,
        }
      : null,
    lastMessage: lastMessage ? toMessageResponse(lastMessage) : null,
    unreadCount,
    blockedByMe,
    blockedByYou,
    isBlocked: blockedByMe || blockedByYou,
  };
}

exports.startChat = async (req, res) => {
  const { otherUserId } = req.body;
  if (!otherUserId) return res.status(400).json({ message: 'otherUserId required' });

  try {
    const isBlocked = await blockRepo.isBlocked(req.user.id, otherUserId) || await blockRepo.isBlocked(otherUserId, req.user.id);
    if (isBlocked) return res.status(403).json({ message: 'Cannot chat with blocked user' });

    const connections = await connectionRepo.listAcceptedConnections(req.user.id);
    const isFriend = connections.some((c) => c.id === otherUserId);
    if (!isFriend) return res.status(403).json({ message: 'User is not a friend. Add them first.' });

    const chat = await getOrCreatePrivateChat(req.user.id, otherUserId);
    // If the user previously deleted this chat for themselves, un-hide it
    // when starting a chat again (prevents "can't chat again after delete").
    await deletedChatRepo.clearDeletion(req.user.id, chat.id);
    const members = await chatRepo.getMembers(chat.id);
    const other = members.find((m) => m.id !== req.user.id);

    return res.json({
      chat: { id: chat.id, _id: chat.id },
      otherId: other?.id,
      otherUser: other ? { uid: other.uid, username: other.username, displayName: other.display_name, avatar: other.avatar || '👤', lastSeen: other.last_seen } : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.listChats = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
    const { chats, hasMore } = await chatRepo.findByMemberPaginated(req.user.id, limit, offset);
    const result = [];
    for (const c of chats) {
      const entry = await buildChatListEntry(req.user.id, c);
      if (entry) result.push(entry);
    }
    return res.json({ chats: result, hasMore });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

/** Search chats by peer name or message content (substring match) */
exports.searchChats = async (req, res) => {
  const q = req.query.q != null ? String(req.query.q).trim() : '';
  if (!q) {
    return res.json({ chats: [], hasMore: false });
  }
  try {
    const idsName = await chatRepo.findChatIdsByPeerNameMatch(req.user.id, q);
    const idsMsg = await messageRepo.searchChatIdsByContent(req.user.id, q);
    const idSet = new Set([...idsName, ...idsMsg]);
    const ordered = await chatRepo.findChatsByIdsOrderedForUser(req.user.id, [...idSet]);
    const result = [];
    for (const c of ordered.slice(0, 100)) {
      const entry = await buildChatListEntry(req.user.id, c);
      if (entry) result.push(entry);
    }
    return res.json({ chats: result, hasMore: false });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.getMessages = async (req, res) => {
  const { chatId } = req.params;
  const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 100);
  const before = req.query.before;

  try {
    const chat = await chatRepo.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const userDeleted = await deletedChatRepo.isDeletedByUser(req.user.id, chatId);
    if (userDeleted) {
      // Allow re-opening a chat even after it was removed from the user's chat list.
      // "deleted_chats" is a UI hide flag, not a hard delete.
      await deletedChatRepo.clearDeletion(req.user.id, chatId);
    }

    const members = await chatRepo.getMembers(chatId);
    const memberIds = members.map((m) => m.id);
    if (!memberIds.includes(req.user.id)) return res.status(403).json({ message: 'Not a member' });

    const other = members.find((m) => m.id !== req.user.id);
    let blockedByMe = false;
    let blockedByYou = false;
    if (other) {
      blockedByMe = await blockRepo.isBlocked(req.user.id, other.id);
      blockedByYou = await blockRepo.isBlocked(other.id, req.user.id);
    }

    const rows = await messageRepo.findByChat(chatId, {
      limit: limit + 1,
      before,
      excludeForUserId: req.user.id,
    });
    const hasMore = rows.length > limit;
    const messages = hasMore ? rows.slice(0, limit) : rows;

    // Mask read status for messages where the recipient has read receipts disabled.
    // If current user is the sender, and the receiver has receipts off, treat "read" as "delivered".
    const receiptsCache = new Map();
    const masked = [];
    for (const row of messages) {
      let out = toMessageResponse(row);
      if (row.status === 'read' && String(row.from_user_id) === String(req.user.id)) {
        const recipientId = row.to_user_id;
        if (!receiptsCache.has(recipientId)) {
          const enabled = await userRepo.getReadReceiptsEnabled(recipientId);
          receiptsCache.set(recipientId, enabled);
        }
        if (receiptsCache.get(recipientId) === false) {
          out = { ...out, status: 'delivered' };
        }
      }
      masked.push(out);
    }

    return res.json({ messages: masked, hasMore, blockedByMe, blockedByYou });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.sendMessage = async (req, res) => {
  const { chatId } = req.params;
  const { content, type, ephemeral, to } = req.body;
  if (!content && type !== 'media') return res.status(400).json({ message: 'content required' });

  try {
    const chat = await chatRepo.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const userDeleted = await deletedChatRepo.isDeletedByUser(req.user.id, chatId);
    if (userDeleted) {
      await deletedChatRepo.clearDeletion(req.user.id, chatId);
    }

    const members = await chatRepo.getMembers(chatId);
    const memberIds = members.map((m) => m.id);
    if (!memberIds.includes(req.user.id)) return res.status(403).json({ message: 'Not a member' });

    const other = members.find((m) => m.id !== req.user.id);
    if (other) {
      const isBlocked = await blockRepo.isBlocked(req.user.id, other.id) || await blockRepo.isBlocked(other.id, req.user.id);
      if (isBlocked) return res.status(403).json({ message: 'Cannot message blocked user' });
    }

    const recipientId = to || members.find((m) => m.id !== req.user.id)?.id;
    if (!recipientId) return res.status(400).json({ message: 'Recipient not found' });

    if ((type || 'text') === 'text' && content) {
      const msgError = blockedWords.validateMessageContent(content);
      if (msgError) return res.status(400).json({ message: msgError });
    }

    const norm = normalizeEphemeralInput(ephemeral || {});
    const message = await messageRepo.create({
      chatId,
      fromUserId: req.user.id,
      toUserId: recipientId,
      content,
      type: type || 'text',
      ephemeral: norm.mode ? { mode: norm.mode } : null,
      expireAt: null,
      isSaved: norm.isSaved,
    });

    const lastMsgDisplay = (type || 'text') === 'media' ? '📷 Photo' : content;
    await chatRepo.updateLastMessage(chatId, lastMsgDisplay);

    return res.status(201).json(toMessageResponse(message));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.uploadChatImage = async (req, res) => {
  const { chatId } = req.params;
  if (!req.file) return res.status(400).json({ message: 'No image file provided' });

  try {
    const chat = await chatRepo.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const userDeleted = await deletedChatRepo.isDeletedByUser(req.user.id, chatId);
    if (userDeleted) {
      await deletedChatRepo.clearDeletion(req.user.id, chatId);
    }

    const members = await chatRepo.getMembers(chatId);
    const memberIds = members.map((m) => m.id);
    if (!memberIds.includes(req.user.id)) return res.status(403).json({ message: 'Not a member' });

    const other = members.find((m) => m.id !== req.user.id);
    if (other) {
      const isBlocked = await blockRepo.isBlocked(req.user.id, other.id) || await blockRepo.isBlocked(other.id, req.user.id);
      if (isBlocked) return res.status(403).json({ message: 'Cannot access chat with blocked user' });
    }

    const imagePath = `/uploads/chat-images/${req.file.filename}`;
    return res.status(201).json({ path: imagePath });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.clearChat = async (req, res) => {
  const { chatId } = req.params;

  try {
    console.log(`[DEBUG] clearChat called by user ${req.user.id} for chat ${chatId}`);
    
    const chat = await chatRepo.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const userDeleted = await deletedChatRepo.isDeletedByUser(req.user.id, chatId);
    if (userDeleted) {
      await deletedChatRepo.clearDeletion(req.user.id, chatId);
    }

    const members = await chatRepo.getMembers(chatId);
    const memberIds = members.map((m) => m.id);
    if (!memberIds.includes(req.user.id)) return res.status(403).json({ message: 'Not a member' });

    const otherUser = members.find((m) => m.id !== req.user.id);
    await messageRepo.deleteByChatId(chatId);
    await chatRepo.updateLastMessage(chatId, null);
    if (otherUser) {
      const io = getIo();
      if (io) {
        console.log(`[DEBUG] Emitting chat:cleared to user ${otherUser.id} for chat ${chatId}`);
        io.to(`user:${otherUser.id}`).emit('chat:cleared', { chatId });
      }
    }
    return res.status(200).json({ status: 'cleared' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteViewOnceMessages = async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  try {
    console.log(`[DEBUG] deleteViewOnceMessages called by user ${userId} for chat ${chatId}`);
    
    const chat = await chatRepo.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const members = await chatRepo.getMembers(chatId);
    const memberIds = members.map((m) => m.id);
    if (!memberIds.includes(userId)) return res.status(403).json({ message: 'Not a member' });

    // Delete all viewOnce messages that have been viewed (first_seen_at is not null)
    await messageRepo.deleteViewedViewOnceMessages(chatId, userId);
    
    const io = getIo();
    if (io) {
      console.log(`[DEBUG] Emitting viewOnce:deleted to user ${userId} for chat ${chatId}`);
      io.to(`user:${userId}`).emit('viewOnce:deleted', { chatId });
    }
    
    return res.status(200).json({ status: 'deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteChat = async (req, res) => {
  const { chatId } = req.params;

  try {
    const chat = await chatRepo.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const members = await chatRepo.getMembers(chatId);
    const memberIds = members.map((m) => m.id);
    if (!memberIds.includes(req.user.id)) return res.status(403).json({ message: 'Not a member' });

    // Delete all messages in this chat
    await messageRepo.deleteByChatId(chatId);
    
    // Clear the last message preview
    await chatRepo.updateLastMessage(chatId, null);
    
    // Record chat deletion for this user
    await deletedChatRepo.recordDeletion(req.user.id, chatId);
    
    const io = getIo();
    if (io) {
      io.to(`user:${req.user.id}`).emit('chat:deleted', { chatId });
      
      // Notify other chat member that messages were cleared
      const otherUser = members.find((m) => m.id !== req.user.id);
      if (otherUser) {
        io.to(`user:${otherUser.id}`).emit('chat:cleared', { chatId });
      }
    }
    
    return res.status(200).json({ status: 'deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

