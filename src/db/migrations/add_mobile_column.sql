-- Add mobile column for phone-based auth (replaces recovery_email as primary)
-- recovery_email becomes optional for backward compatibility
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='mobile') THEN
    ALTER TABLE users ADD COLUMN mobile VARCHAR(20) UNIQUE;
  END IF;
END $$;

-- Make recovery_email nullable for mobile-only users
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='recovery_email') THEN
    ALTER TABLE users ALTER COLUMN recovery_email DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile) WHERE mobile IS NOT NULL;
