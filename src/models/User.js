const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  recovery_email: { type: String, required: true, unique: true },
  display_name: { type: String },
  avatar: { type: String, default: '👤' },
  uid: { type: String, required: true, unique: true },
  app_logo: { type: String },
  last_seen: { type: Date },
  subscription_expires_at: { type: Date },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
