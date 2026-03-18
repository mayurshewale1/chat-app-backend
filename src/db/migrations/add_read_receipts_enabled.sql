-- Add read receipts toggle (WhatsApp-style)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='users' AND column_name='read_receipts_enabled'
  ) THEN
    ALTER TABLE users ADD COLUMN read_receipts_enabled BOOLEAN DEFAULT true;
  END IF;
END $$;

