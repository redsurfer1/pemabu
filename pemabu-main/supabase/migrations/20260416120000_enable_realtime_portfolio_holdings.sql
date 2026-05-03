-- Enable Realtime publication for portfolio_holdings
-- (only if not already added to the supabase_realtime publication)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'portfolio_holdings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE portfolio_holdings;
  END IF;
END $$;
