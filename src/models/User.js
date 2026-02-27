const bcrypt = require('bcryptjs');
const { Schema, model } = require('mongoose');

const nano = () => Math.random().toString(36).replace(/[^0-9A-Z]/gi, '').substr(0, 8).toUpperCase();

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  recoveryEmail: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  displayName: { type: String },
  uid: { type: String, required: true, unique: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

UserSchema.pre('save', async function (next) {
  if (this.isNew) {
    this.uid = `SRN-${nano()}`;
  }
  if (this.recoveryEmail) {
    this.recoveryEmail = this.recoveryEmail.trim().toLowerCase();
  }
  if (this.isModified('password') || this.isNew) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

UserSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = model('User', UserSchema);
