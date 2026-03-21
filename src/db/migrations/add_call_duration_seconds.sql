-- Call duration (seconds) when call was connected and ended normally
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_history' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE call_history ADD COLUMN duration_seconds INTEGER;
  END IF;
END $$;
