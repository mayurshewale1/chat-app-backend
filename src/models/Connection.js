const { Schema, model } = require('mongoose');

const ConnectionSchema = new Schema({
  from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

ConnectionSchema.index({ from: 1, to: 1 }, { unique: true });

module.exports = model('Connection', ConnectionSchema);
