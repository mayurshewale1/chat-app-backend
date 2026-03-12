const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chat_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  from_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String },
  type: { type: String, default: 'text' },
  status: { type: String, default: 'sent', enum: ['sent', 'delivered', 'read'] },
  ephemeral_mode: { type: String, enum: ['24h', '7d', 'viewOnce', 'deleteOnExit'] },
  expire_at: { type: Date },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Message', messageSchema);
