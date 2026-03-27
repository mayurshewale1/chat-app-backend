const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 4000
  },
  messageType: {
    type: String,
    enum: ['normal', 'view_once', 'expire_24h'],
    required: true,
    default: 'normal'
  },
  expiresAt: {
    type: Date,
    index: true
  },
  isDeletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  readAt: {
    type: Date
  },
  deliveredAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// TTL index for 24h expiration
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes for performance
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, isDeletedFor: 1 });
messageSchema.index({ chatId: 1, senderId: 1, receiverId: 1 });

// Virtual for checking if message is deleted for specific user
messageSchema.virtual('isDeletedForUser').get(function() {
  return function(userId) {
    return this.isDeletedFor.some(id => id.toString() === userId.toString());
  };
});

// Static method to find messages for user
messageSchema.statics.findForUser = function(chatId, userId, options = {}) {
  const query = {
    chatId,
    isDeletedFor: { $ne: userId }
  };
  
  if (options.before) {
    query.createdAt = { $lt: options.before };
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

// Instance method to mark as deleted for user
messageSchema.methods.markDeletedForUser = function(userId) {
  if (!this.isDeletedFor.includes(userId)) {
    this.isDeletedFor.push(userId);
  }
  return this.save();
};

module.exports = mongoose.model('Message', messageSchema);
