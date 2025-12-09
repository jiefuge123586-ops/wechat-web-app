const mongoose = require('mongoose');

const readStateSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: String, required: true },
  lastReadAt: { type: Date, default: Date.now }
});
readStateSchema.index({ user: 1, room: 1 }, { unique: true });

module.exports = mongoose.model('ReadState', readStateSchema);
