-- Request history dismissals (swipe hide); accepted connections stay in DB, only hidden from list
CREATE TABLE IF NOT EXISTS connection_history_hidden (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  hidden_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, connection_id)
);
CREATE INDEX IF NOT EXISTS idx_conn_hidden_user ON connection_history_hidden(user_id);

-- Archived chats (per user)
CREATE TABLE IF NOT EXISTS chat_archives (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, chat_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_archives_user ON chat_archives(user_id);

-- Security question for PIN reset (answer stored hashed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='security_question') THEN
    ALTER TABLE users ADD COLUMN security_question VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='security_answer_hash') THEN
    ALTER TABLE users ADD COLUMN security_answer_hash VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='privacy_mask_caller') THEN
    ALTER TABLE users ADD COLUMN privacy_mask_caller BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;
