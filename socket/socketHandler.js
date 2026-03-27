const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const ChatUserSetting = require('../models/ChatUserSetting');

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
        
        // Mark messages as read
        await Message.updateMany(
          {
            chatId,
            receiverId: socket.userId,
            readAt: { $exists: false }
          },
          { readAt: new Date() }
        );

        // Notify other participant
        const chat = await require('../models/Chat').findById(chatId);
        if (chat) {
          const otherParticipant = chat.participants.find(
            p => p.toString() !== socket.userId.toString()
          );
          if (otherParticipant) {
            socket.to(otherParticipant.toString()).emit('messages_read', {
              chatId,
              userId: socket.userId
            });
          }
        }
      } catch (error) {
        console.error('Chat opened error:', error);
        socket.emit('error', { message: 'Failed to open chat' });
      }
    });

    // Handle chat closed
    socket.on('chat_closed', async (data) => {
      try {
        const { chatId } = data;
        
        // Leave chat room
        socket.leave(`chat_${chatId}`);
        
        // Get user's chat setting
        const userMode = await ChatUserSetting.getUserMode(chatId, socket.userId);
        
        // If user mode is view_once, delete received messages
        if (userMode === 'view_once') {
          const messages = await Message.find({
            chatId,
            receiverId: socket.userId,
            messageType: 'view_once',
            isDeletedFor: { $ne: socket.userId }
          });

          // Mark all as deleted for this user
          const deletePromises = messages.map(msg => msg.markDeletedForUser(socket.userId));
          await Promise.all(deletePromises);

          // Emit event to update UI
          socket.emit('messages_deleted_for_user', {
            chatId,
            messageIds: messages.map(msg => msg._id)
          });
        }
      } catch (error) {
        console.error('Chat closed error:', error);
        socket.emit('error', { message: 'Failed to close chat' });
      }
    });

    // Handle typing
    socket.on('typing', (data) => {
      const { chatId, isTyping } = data;
      socket.to(`chat_${chatId}`).emit('user_typing', {
        userId: socket.userId,
        isTyping
      });
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
