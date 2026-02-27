const userRepo = require('../db/userRepository');
const connectionRepo = require('../db/connectionRepository');
const { getOrCreatePrivateChat } = require('../services/chatService');

exports.listPendingRequests = async (req, res) => {
  try {
    const rows = await connectionRepo.listPendingRequestsReceived(req.user.id);
    const requests = rows.map((r) => ({
      id: r.id,
      fromUserId: r.from_user_id,
      uid: r.uid,
      username: r.username,
      displayName: r.display_name,
      avatar: r.avatar || '👤',
      createdAt: r.created_at,
    }));
    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.listSentRequests = async (req, res) => {
  try {
    const rows = await connectionRepo.listPendingRequestsSent(req.user.id);
    const requests = rows.map((r) => ({
      id: r.id,
      toUserId: r.to_user_id,
      uid: r.uid,
      username: r.username,
      displayName: r.display_name,
      avatar: r.avatar || '👤',
      createdAt: r.created_at,
    }));
    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.sendRequest = async (req, res) => {
  const { uid, username } = req.body;
  const identifier = username || uid;
  if (!identifier) return res.status(400).json({ message: 'uid or username required' });
  try {
    const to = username
      ? await userRepo.findByUsername(String(username).trim().toLowerCase().replace(/^@/, ''))
      : await userRepo.findByUid(uid);
    if (!to) return res.status(404).json({ message: 'User not found' });
    if (to.id === req.user.id) return res.status(400).json({ message: 'Cannot add yourself' });

    const exists = await connectionRepo.findByFromTo(req.user.id, to.id);
    if (exists) return res.status(409).json({ message: 'Request already exists' });

    const conn = await connectionRepo.create(req.user.id, to.id);
    return res.status(201).json({
      id: conn.id,
      from: conn.from_user_id,
      to: conn.to_user_id,
      status: conn.status,
      createdAt: conn.created_at,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.acceptRequest = async (req, res) => {
  const { requestId } = req.body;
  if (!requestId) return res.status(400).json({ message: 'requestId required' });
  try {
    const request = await connectionRepo.findById(requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.to_user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

    await connectionRepo.updateStatus(requestId, 'accepted');
    const updated = await connectionRepo.findById(requestId);

    const chat = await getOrCreatePrivateChat(request.from_user_id, request.to_user_id);

    return res.json({
      message: 'Accepted',
      request: {
        id: updated.id,
        from: updated.from_user_id,
        to: updated.to_user_id,
        status: updated.status,
      },
      chatId: chat?.id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.rejectRequest = async (req, res) => {
  const { requestId } = req.body;
  if (!requestId) return res.status(400).json({ message: 'requestId required' });
  try {
    const request = await connectionRepo.findById(requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.to_user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

    await connectionRepo.updateStatus(requestId, 'rejected');
    return res.json({ message: 'Rejected' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.listConnections = async (req, res) => {
  try {
    const connections = await connectionRepo.listAcceptedConnections(req.user.id);
    return res.json(connections.map((c) => ({ id: c.id, uid: c.uid, username: c.username, displayName: c.display_name, avatar: c.avatar || '👤' })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};
