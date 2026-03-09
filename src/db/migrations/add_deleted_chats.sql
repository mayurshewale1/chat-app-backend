-- Soft-delete: retain chat data for 7 days (legal backup) when user deletes
CREATE TABLE IF NOT EXISTS deleted_chats (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, chat_id)
);
CREATE INDEX IF NOT EXISTS idx_deleted_chats_chat ON deleted_chats(chat_id);
CREATE INDEX IF NOT EXISTS idx_deleted_chats_deleted_at ON deleted_chats(deleted_at);
