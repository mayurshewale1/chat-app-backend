-- Per-user message hiding for deleteOnExit (disappear when user leaves chat)
CREATE TABLE IF NOT EXISTS message_deleted_for (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_deleted_for_user ON message_deleted_for(user_id);
