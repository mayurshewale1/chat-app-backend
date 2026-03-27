const Chat = require('../models/Chat');
const User = require('../models/User');

class ChatController {
  // Get user chats
  async getUserChats(req, res) {
    try {
      const userId = req.userId;
      
      const chats = await Chat.getUserChats(userId);
      
      res.json(chats);
    } catch (error) {
      console.error('Get user chats error:', error);
      res.status(500).json({ error: 'Failed to get chats' });
    }
  }

  // Find or create chat
  async findOrCreateChat(req, res) {
    try {
      const { participantId } = req.body;
      const userId = req.userId;

      if (!participantId || participantId === userId) {
        return res.status(400).json({ error: 'Invalid participant' });
      }

      // Check if participant exists
      const participant = await User.findById(participantId);
      if (!participant) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Find or create chat
      const chat = await Chat.findOrCreate(userId, participantId);
      
      res.json(chat);
    } catch (error) {
      console.error('Find or create chat error:', error);
      res.status(500).json({ error: 'Failed to create chat' });
    }
  }

  // Get chat details
  async getChatDetails(req, res) {
    try {
      const { chatId } = req.params;
      const userId = req.userId;

      const chat = await Chat.findOne({ 
        _id: chatId, 
        participants: userId 
      }).populate('participants', 'username avatar email');

      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      res.json(chat);
    } catch (error) {
      console.error('Get chat details error:', error);
      res.status(500).json({ error: 'Failed to get chat details' });
    }
  }
}

module.exports = new ChatController();
