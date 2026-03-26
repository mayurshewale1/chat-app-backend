/**
 * API-facing message shape (matches client expectations).
 * deleteMode: view_once | 24_hours | 7_days | delete_on_exit | null
 */

function normalizeEphemeralInput(ephemeral) {
  if (!ephemeral || ephemeral.mode == null || ephemeral.mode === '') {
    return { mode: null, isSaved: false };
  }
  const raw = String(ephemeral.mode).trim();
  const lower = raw.toLowerCase().replace(/-/g, '_');
  const map = {
    view_once: 'viewOnce',
    viewonce: 'viewOnce',
    '24_hours': '24h',
    '24h': '24h',
    '7_days': '7d',
    '7d': '7d',
    delete_on_exit: 'deleteOnExit',
  };
  const mode = map[lower] || (['viewOnce', '24h', '7d', 'deleteOnExit'].includes(raw) ? raw : null);
  return { mode, isSaved: !!ephemeral.isSaved };
}

function deleteModeToApi(mode) {
  if (!mode) return null;
  if (mode === 'viewOnce') return 'view_once';
  if (mode === '24h') return '24_hours';
  if (mode === '7d') return '7_days';
  if (mode === 'deleteOnExit') return 'delete_on_exit';
  return mode;
}

function toMessageResponse(row) {
  if (!row) return null;
  const createdAt =
    row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
  const seenAt =
    row.first_seen_at instanceof Date
      ? row.first_seen_at.toISOString()
      : row.first_seen_at || null;
  const expireAt =
    row.expire_at instanceof Date ? row.expire_at.toISOString() : row.expire_at || null;

  return {
    id: row.id,
    _id: row.id,
    chat: row.chat_id,
    from: row.from_user_id,
    to: row.to_user_id,
    content: row.content,
    type: row.type,
    status: row.status,
    ephemeral: row.ephemeral_mode ? { mode: row.ephemeral_mode } : null,
    deleteMode: deleteModeToApi(row.ephemeral_mode),
    seenAt,
    expireAt,
    createdAt,
    isDeletedForEveryone: !!row.deleted_for_everyone,
    isDeleted: !!row.deleted_for_everyone,
    isSaved: !!row.is_saved,
  };
}

module.exports = {
  normalizeEphemeralInput,
  toMessageResponse,
  deleteModeToApi,
};
