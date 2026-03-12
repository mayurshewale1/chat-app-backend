-- Add active column for soft delete (deactivated users cannot login, data retained)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='active') THEN
    ALTER TABLE users ADD COLUMN active BOOLEAN DEFAULT true;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_active ON users(active) WHERE active = true;
