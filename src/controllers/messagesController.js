const messageRepo = require('../db/messageRepository');
const { toMessageResponse } = require('../utils/messageResponse');
const {
  processRecipientRead,
  processRecipientReadAndEmit,
} = require('../services/ephemeralMessageService');

exports.markDelivered = async (req, res) => {
  const { id } = req.params;
  try {
    const m = await messageRepo.findById(id);
    if (!m) return res.status(404).json({ message: 'Message not found' });
    if (m.to_user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

    await messageRepo.updateStatus(id, 'delivered');
    return res.json({ message: 'updated' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.markRead = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await processRecipientReadAndEmit(req.user.id, id);
    if (!result.ok) {
      if (result.reason === 'not_found' || result.reason === 'gone') {
        return res.status(404).json({ message: 'Message not found' });
      }
      if (result.reason === 'not_recipient') return res.status(403).json({ message: 'Not authorized' });
      return res.status(400).json({ message: 'Cannot update message' });
    }
    if (result.deleted) {
      return res.json({ message: 'viewed and deleted', deleted: true });
    }
    const row = await messageRepo.findById(id);
    return res.json(toMessageResponse(row));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.saveMessage = async (req, res) => {
  const { messageId } = req.params;
  try {
    const m = await messageRepo.findById(messageId);
    if (!m) return res.status(404).json({ message: 'Message not found' });
    if (m.from_user_id !== req.user.id && m.to_user_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const updated = await messageRepo.setSaved(messageId, true);
    return res.json(toMessageResponse(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.unsaveMessage = async (req, res) => {
  const { messageId } = req.params;
  try {
    const m = await messageRepo.findById(messageId);
    if (!m) return res.status(404).json({ message: 'Message not found' });
    if (m.from_user_id !== req.user.id && m.to_user_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const updated = await messageRepo.setSaved(messageId, false);
    return res.json(toMessageResponse(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};
