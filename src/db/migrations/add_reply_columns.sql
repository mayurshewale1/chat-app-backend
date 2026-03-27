-- Add reply functionality columns to messages table
-- Migration for reply feature

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'reply_to_message_id') THEN
    ALTER TABLE messages ADD COLUMN reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'reply_to_text') THEN
    ALTER TABLE messages ADD COLUMN reply_to_text TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'reply_to_sender') THEN
    ALTER TABLE messages ADD COLUMN reply_to_sender BOOLEAN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'reply_to_type') THEN
    ALTER TABLE messages ADD COLUMN reply_to_type VARCHAR(20);
  END IF;
END $$;

-- Create index for reply_to_message_id for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_message_id ON messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
