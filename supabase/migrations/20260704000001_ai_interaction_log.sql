-- 20260704000001_ai_interaction_log.sql
-- SOC 2 compliance: immutable audit trail for every AI model invocation.
-- Records who asked which model what, how long it took, and what it returned
-- (response preview). This is the evidence artifact for AI governance reviews.

CREATE TABLE IF NOT EXISTS public.ai_interaction_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  feature         text NOT NULL,
  model           text NOT NULL,
  prompt_hash     text NOT NULL,
  prompt_tokens   int  NOT NULL DEFAULT 0,
  output_tokens   int  NOT NULL DEFAULT 0,
  latency_ms      int  NOT NULL DEFAULT 0,
  response_preview text NOT NULL DEFAULT '',
  disclaimer_shown boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.ai_interaction_log IS 'Immutable AI audit trail for SOC 2. Every Anthropic call is logged here.';
COMMENT ON COLUMN public.ai_interaction_log.feature IS 'Canonical feature name (e.g. signal_narrative, portfolio_brief, explain_holding, governance_summary, strategy_council_memo)';
COMMENT ON COLUMN public.ai_interaction_log.prompt_hash IS 'SHA-256 hex digest of the prompt (for dedup / prompt inspection without storing full text)';
COMMENT ON COLUMN public.ai_interaction_log.response_preview IS 'First 500 chars of the AI response (for audit review without requiring regeneration)';
COMMENT ON COLUMN public.ai_interaction_log.disclaimer_shown IS 'True if the output was presented alongside the standard AI disclaimer';

-- RLS: users see only their own rows; service role inserts.
ALTER TABLE public.ai_interaction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_interaction_log_select_owner
  ON public.ai_interaction_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY ai_interaction_log_insert_service
  ON public.ai_interaction_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Permissions
GRANT SELECT ON public.ai_interaction_log TO authenticated;
GRANT INSERT ON public.ai_interaction_log TO service_role;

-- Index for common compliance queries
CREATE INDEX ai_interaction_log_user_feature_idx
  ON public.ai_interaction_log (user_id, feature, created_at DESC);
