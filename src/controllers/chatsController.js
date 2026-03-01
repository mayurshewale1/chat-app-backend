const chatRepo = require('../db/chatRepository');
const messageRepo = require('../db/messageRepository');
const connectionRepo = require('../db/connectionRepository');
const { getOrCreatePrivateChat } = require('../services/chatService');

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

exports.startChat = async (req, res) => {
  const { otherUserId } = req.body;
  if (!otherUserId) return res.status(400).json({ message: 'otherUserId required' });

  try {
    const connections = await connectionRepo.listAcceptedConnections(req.user.id);
    const isFriend = connections.some((c) => c.id === otherUserId);
    if (!isFriend) return res.status(403).json({ message: 'User is not a friend. Add them first.' });

    const chat = await getOrCreatePrivateChat(req.user.id, otherUserId);
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
    const chats = await chatRepo.findByMember(req.user.id);
    const result = await Promise.all(
      chats.map(async (c) => {
        const members = await chatRepo.getMembers(c.id);
        const other = members.find((m) => m.id !== req.user.id);
        const lastMessage = await messageRepo.getLastMessage(c.id);

        return {
          chat: {
            id: c.id,
            _id: c.id,
            members: members.map((m) => ({ id: m.id, uid: m.uid, username: m.username, displayName: m.display_name, avatar: m.avatar || '👤' })),
            lastMessage: c.last_message,
            createdAt: c.created_at,
          },
          otherId: other?.id,
          otherUser: other ? { uid: other.uid, username: other.username, displayName: other.display_name, avatar: other.avatar || '👤', lastSeen: other.last_seen } : null,
          lastMessage: lastMessage ? toMessageResponse(lastMessage) : null,
        };
      })
    );
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.getMessages = async (req, res) => {
  const { chatId } = req.params;
  const limit = parseInt(req.query.limit || '50', 10);
  const before = req.query.before;

  try {
    const chat = await chatRepo.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const members = await chatRepo.getMembers(chatId);
    const memberIds = members.map((m) => m.id);
    if (!memberIds.includes(req.user.id)) return res.status(403).json({ message: 'Not a member' });

    const messages = await messageRepo.findByChat(chatId, { limit, before });
    return res.json(messages.map(toMessageResponse));
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

    const members = await chatRepo.getMembers(chatId);
    const memberIds = members.map((m) => m.id);
    if (!memberIds.includes(req.user.id)) return res.status(403).json({ message: 'Not a member' });

    const recipientId = to || members.find((m) => m.id !== req.user.id)?.id;
    if (!recipientId) return res.status(400).json({ message: 'Recipient not found' });

    let expireAt = null;
    if (ephemeral && ephemeral.mode === '24h') {
      expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const message = await messageRepo.create({
      chatId,
      fromUserId: req.user.id,
      toUserId: recipientId,
      content,
      type: type || 'text',
      ephemeral: ephemeral || null,
      expireAt,
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

    const members = await chatRepo.getMembers(chatId);
    const memberIds = members.map((m) => m.id);
    if (!memberIds.includes(req.user.id)) return res.status(403).json({ message: 'Not a member' });

    const imagePath = `/uploads/chat-images/${req.file.filename}`;
    return res.status(201).json({ path: imagePath });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};
