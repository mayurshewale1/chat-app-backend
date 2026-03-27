const Message = require('../models/Message-snapchat');
const Chat = require('../models/Chat-snapchat');
const ChatUserSetting = require('../models/ChatUserSetting-snapchat');
const { getIO } = require('../socket/socketHandler-snapchat');

class MessageController {
  // Send message
  async sendMessage(req, res) {
    try {
      const { chatId, content } = req.body;
      const senderId = req.userId;

      // Validate
      if (!chatId || !content) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Verify chat exists and user is participant
      const chat = await Chat.findOne({ 
        _id: chatId, 
        participants: senderId 
      });
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      // Get receiverId (the other participant)
      const receiverId = chat.participants.find(
        p => p.toString() !== senderId.toString()
      );

      // Get sender's chat setting
      const userSetting = await ChatUserSetting.getUserMode(chatId, senderId);
      
      // Set expiration for 24h mode
      let expiresAt = null;
      if (userSetting === 'expire_24h') {
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      }

      // Create message (NO messageType field - handled by user mode)
      const message = new Message({
        chatId,
        senderId,
        content,
        expiresAt
      });

      await message.save();

      // Update chat last message
      await Chat.findByIdAndUpdate(chatId, {
        lastMessage: content,
        lastMessageAt: new Date()
      });

      // Get populated message
      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'username avatar');

      // Emit to receiver
      const io = getIO();
      io.to(receiverId.toString()).emit('receive_message', populatedMessage);

      res.status(201).json(populatedMessage);
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  // Get chat messages (filters deleted for user)
  async getMessages(req, res) {
    try {
      const { chatId } = req.params;
      const userId = req.userId;
      const { before, limit = 50 } = req.query;

      // Verify chat exists and user is participant
      const chat = await Chat.findOne({ 
        _id: chatId, 
        participants: userId 
      });
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      // Get messages for user (automatically filters deleted)
      const messages = await Message.findForUser(chatId, userId, {
        before: before ? new Date(before) : null,
        limit: parseInt(limit)
      });

      res.json(messages);
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  }

  // Delete view_once messages for user (session-based)
  async deleteViewOnceMessages(req, res) {
    try {
      const { chatId } = req.params;
      const userId = req.userId;

      // Find all received messages in this chat (not sent by user)
      const messages = await Message.find({
        chatId,
        senderId: { $ne: userId },
        isDeletedFor: { $ne: userId }
      });

      // Mark all as deleted for this user
      const deletePromises = messages.map(msg => msg.markDeletedForUser(userId));
      await Promise.all(deletePromises);

      // Emit event to update UI
      const io = getIO();
      io.to(userId.toString()).emit('messages_deleted_for_user', {
        chatId,
        messageIds: messages.map(msg => msg._id)
      });

      res.json({ 
        success: true, 
        deletedCount: messages.length 
      });
    } catch (error) {
      console.error('Delete view_once messages error:', error);
      res.status(500).json({ error: 'Failed to delete messages' });
    }
  }

  // Update user chat setting
  async updateChatSetting(req, res) {
    try {
      const { chatId } = req.params;
      const { mode } = req.body;
      const userId = req.userId;

      if (!['normal', 'view_once', 'expire_24h'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode' });
      }

      // Verify chat exists and user is participant
      const chat = await Chat.findOne({ 
        _id: chatId, 
        participants: userId 
      });
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      // Update or create setting
      const setting = await ChatUserSetting.getOrCreate(chatId, userId, mode);
      setting.mode = mode;
      await setting.save();

      res.json(setting);
    } catch (error) {
      console.error('Update chat setting error:', error);
      res.status(500).json({ error: 'Failed to update setting' });
    }
  }

  // Get user chat setting
  async getChatSetting(req, res) {
    try {
      const { chatId } = req.params;
      const userId = req.userId;

      // Verify chat exists and user is participant
      const chat = await Chat.findOne({ 
        _id: chatId, 
        participants: userId 
      });
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      const mode = await ChatUserSetting.getUserMode(chatId, userId);
      res.json({ mode });
    } catch (error) {
      console.error('Get chat setting error:', error);
      res.status(500).json({ error: 'Failed to get setting' });
    }
  }
}

module.exports = new MessageController();
