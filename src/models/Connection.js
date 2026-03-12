const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
  from_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, default: 'pending', enum: ['pending', 'accepted', 'rejected'] },
  created_at: { type: Date, default: Date.now },
});

connectionSchema.index({ from_user_id: 1, to_user_id: 1 }, { unique: true });

module.exports = mongoose.model('Connection', connectionSchema);
