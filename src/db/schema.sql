-- Chat App PostgreSQL Schema
-- Complete schema with all columns and tables
-- gen_random_uuid() is built-in in PostgreSQL 13+

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  recovery_email VARCHAR(255),
  display_name VARCHAR(100),
  avatar VARCHAR(500) DEFAULT '👤',
  uid VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  app_logo VARCHAR(500),
  last_seen TIMESTAMPTZ,
  subscription_expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  mobile VARCHAR(20) UNIQUE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  read_receipts_enabled BOOLEAN DEFAULT TRUE,
  security_question VARCHAR(255),
  security_answer_hash VARCHAR(255),
  privacy_mask_caller BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_recovery_email ON users(recovery_email) WHERE recovery_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile) WHERE mobile IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active) WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_members (
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);

-- Soft-delete: user "deletes" chat but we retain for 7 days (legal backup)
CREATE TABLE IF NOT EXISTS deleted_chats (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, chat_id)
);
CREATE INDEX IF NOT EXISTS idx_deleted_chats_chat ON deleted_chats(chat_id);
CREATE INDEX IF NOT EXISTS idx_deleted_chats_deleted_at ON deleted_chats(deleted_at);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  type VARCHAR(20) DEFAULT 'text',
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  ephemeral_mode VARCHAR(20) CHECK (ephemeral_mode IN ('24h', '7d', 'viewOnce', 'deleteOnExit')),
  expire_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_for_everyone BOOLEAN NOT NULL DEFAULT FALSE,
  first_seen_at TIMESTAMPTZ,
  is_saved BOOLEAN NOT NULL DEFAULT FALSE,
  reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  reply_to_text TEXT,
  reply_to_sender BOOLEAN,
  reply_to_type VARCHAR(20),
  duration INTEGER,
  file_name VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_expire ON messages(expire_at) WHERE expire_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_connections_from ON connections(from_user_id);
CREATE INDEX IF NOT EXISTS idx_connections_to ON connections(to_user_id);

-- Call history
CREATE TABLE IF NOT EXISTS call_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  call_type VARCHAR(10) NOT NULL CHECK (call_type IN ('voice', 'video')),
  status VARCHAR(20) NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'completed', 'missed', 'rejected', 'cancelled')),
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_history_caller ON call_history(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_history_callee ON call_history(callee_id);
CREATE INDEX IF NOT EXISTS idx_call_history_created ON call_history(created_at DESC);

-- Connection codes: one-time unique IDs for adding friends
CREATE TABLE IF NOT EXISTS connection_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL UNIQUE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_connection_codes_user ON connection_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_connection_codes_code ON connection_codes(code);
CREATE INDEX IF NOT EXISTS idx_connection_codes_unused ON connection_codes(code) WHERE used_at IS NULL;

-- Blocked users
CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);

-- Request history dismissals
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

-- Device tokens for push notifications (FCM)
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token VARCHAR(500) NOT NULL,
  platform VARCHAR(10) CHECK (platform IN ('android', 'ios')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fcm_token)
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
