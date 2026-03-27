const Message = require('../models/Message');
const Chat = require('../models/Chat');
const ChatUserSetting = require('../models/ChatUserSetting');
const { getIO } = require('../socket/socketHandler');

class MessageController {
  // Send message
  async sendMessage(req, res) {
    try {
      const { chatId, content, receiverId } = req.body;
      const senderId = req.userId;

      // Validate
      if (!chatId || !content || !receiverId) {
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

      // Get sender's chat setting
      const userSetting = await ChatUserSetting.getUserMode(chatId, senderId);
      
      // Determine message type and expiration
      let messageType = 'normal';
      let expiresAt = null;

      if (userSetting === 'view_once') {
        messageType = 'view_once';
      } else if (userSetting === 'expire_24h') {
        messageType = 'expire_24h';
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      }

      // Create message
      const message = new Message({
        chatId,
        senderId,
        receiverId,
        content,
        messageType,
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
        .populate('senderId', 'username avatar')
        .populate('receiverId', 'username avatar');

      // Emit to receiver
      const io = getIO();
      io.to(receiverId.toString()).emit('message_received', populatedMessage);

      res.status(201).json(populatedMessage);
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  // Get chat messages
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

      // Get messages for user
      const messages = await Message.findForUser(chatId, userId, {
        before: before ? new Date(before) : null,
        limit: parseInt(limit)
      })
      .populate('senderId', 'username avatar')
      .populate('receiverId', 'username avatar');

      res.json(messages);
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  }

  // Mark messages as read
  async markAsRead(req, res) {
    try {
      const { chatId } = req.params;
      const userId = req.userId;

      await Message.updateMany(
        {
          chatId,
          receiverId: userId,
          readAt: { $exists: false }
        },
        { readAt: new Date() }
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  }

  // Delete view_once messages for user
  async deleteViewOnceMessages(req, res) {
    try {
      const { chatId } = req.params;
      const userId = req.userId;

      // Find all view_once messages received by this user in this chat
      const messages = await Message.find({
        chatId,
        receiverId: userId,
        messageType: 'view_once',
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
