const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  last_message: { type: String },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Chat', chatSchema);
