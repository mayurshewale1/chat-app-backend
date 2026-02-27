const callHistoryRepo = require('../db/callHistoryRepository');

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
