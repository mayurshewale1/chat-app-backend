const jwt = require('jsonwebtoken');
const User = require('../models/User-snapchat');
const Message = require('../models/Message-snapchat');
const ChatUserSetting = require('../models/ChatUserSetting-snapchat');

let io;

// Initialize Socket.IO
const initializeSocket = (server) => {
  io = require('socket.io')(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"]
    }
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id;
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  // Handle connections
  io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected`);
    
    // Join user to their personal room
    socket.join(socket.userId.toString());
    
    // Update user online status
    User.findByIdAndUpdate(socket.userId, { 
      isOnline: true,
      lastSeen: new Date()
    }).exec();

    // Handle chat opened
    socket.on('chat_opened', async (data) => {
      try {
        const { chatId } = data;
        
        // Join chat room
        socket.join(`chat_${chatId}`);
        
        console.log(`User ${socket.userId} opened chat ${chatId}`);
      } catch (error) {
        console.error('Chat opened error:', error);
        socket.emit('error', { message: 'Failed to open chat' });
      }
    });

    // Handle chat closed - CRITICAL SNAPCHAT LOGIC
    socket.on('chat_closed', async (data) => {
      try {
        const { chatId } = data;
        
        // Leave chat room
        socket.leave(`chat_${chatId}`);
        
        console.log(`User ${socket.userId} closed chat ${chatId}`);
        
        // Get user's chat setting
        const userMode = await ChatUserSetting.getUserMode(chatId, socket.userId);
        
        // SNAPCHAT-STYLE: If user mode is view_once, delete ALL received messages
        if (userMode === 'view_once') {
          console.log(`Deleting view_once messages for user ${socket.userId} in chat ${chatId}`);
          
          // Find all received messages in this chat (not sent by user)
          const messages = await Message.find({
            chatId,
            senderId: { $ne: socket.userId },
            isDeletedFor: { $ne: socket.userId }
          });

          // Mark all as deleted for this user (session-based deletion)
          const deletePromises = messages.map(msg => msg.markDeletedForUser(socket.userId));
          await Promise.all(deletePromises);

          // Emit event to update UI
          socket.emit('messages_deleted_for_user', {
            chatId,
            messageIds: messages.map(msg => msg._id)
          });

          console.log(`Deleted ${messages.length} messages for user ${socket.userId}`);
        }
      } catch (error) {
        console.error('Chat closed error:', error);
        socket.emit('error', { message: 'Failed to close chat' });
      }
    });

    // Handle send message
    socket.on('send_message', async (data) => {
      try {
        const { chatId, content } = data;
        const senderId = socket.userId;

        // Validate
        if (!chatId || !content) {
          return socket.emit('error', { message: 'Missing required fields' });
        }

        // Verify chat exists and user is participant
        const Chat = require('../models/Chat-snapchat');
        const chat = await Chat.findOne({ 
          _id: chatId, 
          participants: senderId 
        });
        if (!chat) {
          return socket.emit('error', { message: 'Chat not found' });
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
        socket.to(receiverId.toString()).emit('receive_message', populatedMessage);

        // Emit confirmation to sender
        socket.emit('message_sent', populatedMessage);

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User ${socket.userId} disconnected`);
      
      // Update user offline status
      User.findByIdAndUpdate(socket.userId, { 
        isOnline: false,
        lastSeen: new Date()
      }).exec();
    });
  });

  return io;
};

// Get IO instance
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

// Emit to specific user
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(userId.toString()).emit(event, data);
  }
};

// Emit to chat room
const emitToChat = (chatId, event, data) => {
  if (io) {
    io.to(`chat_${chatId}`).emit(event, data);
  }
};

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
  emitToChat
};
