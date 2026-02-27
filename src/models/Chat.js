const { Schema, model } = require('mongoose');

const ChatSchema = new Schema({
  members: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
});

ChatSchema.index({ members: 1 });

module.exports = model('Chat', ChatSchema);
