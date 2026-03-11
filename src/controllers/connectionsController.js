const userRepo = require('../db/userRepository');
const connectionRepo = require('../db/connectionRepository');
const blockRepo = require('../db/blockRepository');
const connectionCodeRepo = require('../db/connectionCodeRepository');
const { getOrCreatePrivateChat } = require('../services/chatService');
const { getIo } = require('../ioHolder');
const pushService = require('../services/pushService');

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

    const isBlocked = await blockRepo.isBlocked(req.user.id, to.id) || await blockRepo.isBlocked(to.id, req.user.id);
    if (isBlocked) return res.status(403).json({ message: 'Cannot send request to blocked user' });

    const exists = await connectionRepo.findByFromTo(req.user.id, to.id);
    if (exists) return res.status(409).json({ message: 'Request already exists' });

    const conn = await connectionRepo.create(req.user.id, to.id);
    // Push notification for friend request
    const fromName = req.user.display_name || req.user.username || 'Someone';
    pushService.notifyFriendRequest({
      toUserId: to.id,
      fromName,
      requestId: conn.id,
    }).catch(() => {});
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
    const filtered = [];
    for (const c of connections) {
      const blocked = await blockRepo.isBlocked(req.user.id, c.id) || await blockRepo.isBlocked(c.id, req.user.id);
      if (!blocked) filtered.push(c);
    }
    return res.json(filtered.map((c) => ({ id: c.id, uid: c.uid, username: c.username, displayName: c.display_name, avatar: c.avatar || '👤' })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.generateConnectionCode = async (req, res) => {
  try {
    const codeRow = await connectionCodeRepo.create(req.user.id);
    return res.status(201).json({
      id: codeRow.id,
      code: codeRow.code,
      createdAt: codeRow.created_at,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || 'Failed to generate code' });
  }
};

exports.addByCode = async (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ message: 'Connection code required' });
  }
  const normalized = code.trim().toUpperCase();
  try {
    const codeRow = await connectionCodeRepo.findByCode(normalized);
    if (!codeRow) {
      return res.status(404).json({ message: 'Invalid or expired connection code' });
    }
    const ownerId = codeRow.user_id;
    const myId = req.user.id;
    if (ownerId === myId) {
      return res.status(400).json({ message: 'Cannot add yourself' });
    }
    const isBlocked = await blockRepo.isBlocked(myId, ownerId) || await blockRepo.isBlocked(ownerId, myId);
    if (isBlocked) return res.status(403).json({ message: 'Cannot add blocked user' });
    const exists = await connectionRepo.findByFromTo(myId, ownerId);
    if (exists) {
      return res.status(409).json({ message: 'Connection request already exists' });
    }
    const conn = await connectionRepo.create(myId, ownerId);
    await connectionCodeRepo.markUsed(codeRow.id);
    // Push notification for friend request
    const fromUser = await userRepo.findById(myId);
    const fromName = fromUser?.display_name || fromUser?.username || 'Someone';
    pushService.notifyFriendRequest({
      toUserId: ownerId,
      fromName,
      requestId: conn.id,
    }).catch(() => {});
    const io = getIo();
    if (io) io.to(`user:${ownerId}`).emit('connection:code-used', { codeId: codeRow.id });
    return res.status(201).json({
      id: conn.id,
      from: conn.from_user_id,
      to: conn.to_user_id,
      status: conn.status,
      createdAt: conn.created_at,
      message: 'Connection request sent!',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.listMyCodes = async (req, res) => {
  try {
    const codes = await connectionCodeRepo.listActiveByUser(req.user.id);
    return res.json(codes.map((c) => ({ id: c.id, code: c.code, createdAt: c.created_at })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.removeConnection = async (req, res) => {
  const { otherUserId } = req.body;
  if (!otherUserId) return res.status(400).json({ message: 'otherUserId required' });
  try {
    const removed = await connectionRepo.removeBetweenUsers(req.user.id, otherUserId);
    if (!removed) return res.status(404).json({ message: 'Connection not found or already removed' });
    return res.json({ message: 'Friend removed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.blockUser = async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: 'userId required' });
  if (userId === req.user.id) return res.status(400).json({ message: 'Cannot block yourself' });
  try {
    await blockRepo.block(req.user.id, userId);
    await connectionRepo.removeBetweenUsers(req.user.id, userId);
    return res.json({ message: 'User blocked' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.unblockUser = async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: 'userId required' });
  try {
    const unblocked = await blockRepo.unblock(req.user.id, userId);
    if (!unblocked) return res.status(404).json({ message: 'User not blocked' });
    return res.json({ message: 'User unblocked' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.listBlocked = async (req, res) => {
  try {
    const rows = await blockRepo.listBlocked(req.user.id);
    return res.json(rows.map((r) => ({
      id: r.id,
      uid: r.uid,
      username: r.username,
      displayName: r.display_name,
      avatar: r.avatar || '👤',
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};
