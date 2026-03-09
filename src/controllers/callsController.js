const callHistoryRepo = require('../db/callHistoryRepository');
const config = require('../config');

/**
 * Returns ICE servers for WebRTC (STUN + TURN).
 * TURN enables calls across different networks (WiFi vs mobile data).
 * Option A: Metered API - METERED_APP_NAME + METERED_API_KEY
 * Option B: Static - TURN_URL, TURN_USERNAME, TURN_CREDENTIAL
 */
exports.getIceServers = async (req, res) => {
  const defaultStun = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
  ];

  if (config.METERED_APP_NAME && config.METERED_API_KEY) {
    try {
      const url = `https://${config.METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${config.METERED_API_KEY}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        const servers = Array.isArray(data) ? data : (data.iceServers || data);
        if (servers && servers.length > 0) {
          return res.json({ iceServers: servers });
        }
      }
    } catch (err) {
      console.warn('Metered TURN fetch failed, falling back to STUN only:', err.message);
    }
  }

  const iceServers = [...defaultStun];
  if (config.TURN_URL && config.TURN_USERNAME && config.TURN_CREDENTIAL) {
    iceServers.push({
      urls: config.TURN_URL,
      username: config.TURN_USERNAME,
      credential: config.TURN_CREDENTIAL,
    });
  }
  return res.json({ iceServers });
};

exports.deleteCall = async (req, res) => {
  try {
    const deleted = await callHistoryRepo.deleteByIdForUser(req.params.id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Call not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('delete call error', err);
    return res.status(500).json({ message: 'Failed to delete call' });
  }
};

exports.deleteAllCalls = async (req, res) => {
  try {
    const count = await callHistoryRepo.deleteAllForUser(req.user.id);
    return res.json({ success: true, deleted: count });
  } catch (err) {
    console.error('delete all calls error', err);
    return res.status(500).json({ message: 'Failed to delete calls' });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const rows = await callHistoryRepo.listByUserId(req.user.id);
    const history = rows.map((row) => {
      const isOutgoing = row.caller_id === req.user.id;
      const other = isOutgoing
        ? {
            id: row.callee_user_id,
            username: row.callee_username,
            displayName: row.callee_display_name,
            avatar: row.callee_avatar || '👤',
          }
        : {
            id: row.caller_user_id,
            username: row.caller_username,
            displayName: row.caller_display_name,
            avatar: row.caller_avatar || '👤',
          };
      let status = row.status;
      if (!isOutgoing && row.status === 'cancelled') status = 'missed';
      return {
        id: row.id,
        otherUser: other,
        direction: isOutgoing ? 'outgoing' : 'incoming',
        callType: row.call_type,
        status,
        createdAt: row.created_at,
      };
    });
    return res.json(history);
  } catch (err) {
    console.error('get call history error', err);
    return res.status(500).json({ message: 'Failed to fetch call history' });
  }
};
