const { Schema, model } = require('mongoose');

const MessageSchema = new Schema({
  chat: { type: Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
  from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String },
  type: { type: String, default: 'text' },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  ephemeral: {
    mode: { type: String, enum: ['24h', 'viewOnce', 'deleteOnExit', null], default: null },
  },
  expireAt: { type: Date, index: true },
  createdAt: { type: Date, default: Date.now },
});

MessageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = model('Message', MessageSchema);
