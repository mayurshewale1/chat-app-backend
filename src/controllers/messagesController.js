const messageRepo = require('../db/messageRepository');

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
    const m = await messageRepo.findById(id);
    if (!m) return res.status(404).json({ message: 'Message not found' });
    if (m.to_user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

    if (m.ephemeral_mode === 'viewOnce') {
      await messageRepo.deleteById(id);
      return res.json({ message: 'viewed and deleted' });
    }
    if (m.ephemeral_mode === '24h') {
      const expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await messageRepo.setExpireAtAndStatus(id, expireAt, 'read');
      return res.json({ message: 'updated' });
    }
    if (m.ephemeral_mode === '7d') {
      const expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await messageRepo.setExpireAtAndStatus(id, expireAt, 'read');
      return res.json({ message: 'updated' });
    }

    await messageRepo.updateStatus(id, 'read');
    return res.json({ message: 'updated' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};
