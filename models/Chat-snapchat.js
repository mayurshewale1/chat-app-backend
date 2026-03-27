const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: String,
    default: ''
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Ensure only 2 participants per chat
chatSchema.pre('save', function(next) {
  if (this.participants.length !== 2) {
    return next(new Error('Chat must have exactly 2 participants'));
  }
  next();
});

// Compound unique index for participants
chatSchema.index({ participants: 1 }, { unique: true });

// Static method to find or create chat
chatSchema.statics.findOrCreate = async function(user1Id, user2Id) {
  const participants = [user1Id, user2Id].sort();
  
  let chat = await this.findOne({ 
    participants: { $all: participants, $size: 2 }
  }).populate('participants', 'username avatar');
  
  if (!chat) {
    chat = new this({ participants });
    await chat.save();
    await chat.populate('participants', 'username avatar');
  }
  
  return chat;
};

// Static method to get user chats
chatSchema.statics.getUserChats = function(userId) {
  return this.find({ 
    participants: userId,
    isActive: true 
  })
  .populate('participants', 'username avatar')
  .sort({ lastMessageAt: -1 });
};

module.exports = mongoose.model('Chat', chatSchema);
