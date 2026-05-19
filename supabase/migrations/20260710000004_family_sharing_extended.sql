-- 20260710000004_family_sharing_extended.sql
-- Extends family sharing with portfolio-level scoping and cached aggregate snapshots.

ALTER TABLE public.family_share_tokens
  ADD COLUMN IF NOT EXISTS portfolio_id uuid REFERENCES public.portfolios (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_family_share_tokens_portfolio
  ON public.family_share_tokens (portfolio_id);

CREATE TABLE IF NOT EXISTS public.family_portfolio_snapshots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_share_token_id uuid NOT NULL REFERENCES public.family_share_tokens (id) ON DELETE CASCADE,
  snapshot_data         jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_portfolio_snapshots_token_computed
  ON public.family_portfolio_snapshots (family_share_token_id, computed_at DESC);

ALTER TABLE public.family_portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY family_portfolio_snapshots_select_owner
  ON public.family_portfolio_snapshots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_share_tokens t
      WHERE t.id = family_portfolio_snapshots.family_share_token_id
        AND t.owner_user_id = auth.uid()
    )
  );

GRANT SELECT ON public.family_portfolio_snapshots TO authenticated;
GRANT ALL ON public.family_portfolio_snapshots TO service_role;

COMMENT ON COLUMN public.family_share_tokens.portfolio_id IS
  'Optional: scope the share token to a single portfolio. Null means all portfolios.';

COMMENT ON TABLE public.family_portfolio_snapshots IS
  'Cached aggregate portfolio snapshot data for family sharing viewers. Computed by service role.';
