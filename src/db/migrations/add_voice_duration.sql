-- Add duration column for voice messages
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'duration') THEN
    ALTER TABLE messages ADD COLUMN duration INTEGER;
  END IF;
END $$;
