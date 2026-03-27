const mongoose = require('mongoose');

const chatUserSettingSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  mode: {
    type: String,
    enum: ['normal', 'view_once', 'expire_24h'],
    required: true,
    default: 'normal'
  }
}, {
  timestamps: true
});

// Compound unique index
chatUserSettingSchema.index({ chatId: 1, userId: 1 }, { unique: true });

// Static method to get or create setting
chatUserSettingSchema.statics.getOrCreate = async function(chatId, userId, mode = 'normal') {
  let setting = await this.findOne({ chatId, userId });
  if (!setting) {
    setting = new this({ chatId, userId, mode });
    await setting.save();
  }
  return setting;
};

// Static method to get user's mode for chat
chatUserSettingSchema.statics.getUserMode = async function(chatId, userId) {
  const setting = await this.findOne({ chatId, userId });
  return setting ? setting.mode : 'normal';
};

module.exports = mongoose.model('ChatUserSetting', chatUserSettingSchema);
