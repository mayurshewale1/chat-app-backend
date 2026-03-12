-- Store user preference for push notifications (backend checks before sending)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='notifications_enabled') THEN
    ALTER TABLE users ADD COLUMN notifications_enabled BOOLEAN DEFAULT true;
  END IF;
END $$;
