-- WhatsApp-style "delete for everyone": keep row, strip content, show tombstone in UI
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'deleted_for_everyone'
  ) THEN
    ALTER TABLE messages ADD COLUMN deleted_for_everyone BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;
