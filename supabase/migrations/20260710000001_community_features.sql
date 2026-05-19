-- 20260710000001_community_features.sql
-- Community features: ratings, reviews, discussions, and replies for marketplace strategies.

CREATE TABLE IF NOT EXISTS public.strategy_ratings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid NOT NULL REFERENCES public.marketplace_strategies (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  rating     integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (strategy_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.strategy_reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid NOT NULL REFERENCES public.marketplace_strategies (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  rating     integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title      text NOT NULL DEFAULT '',
  body       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (strategy_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.strategy_discussions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid NOT NULL REFERENCES public.marketplace_strategies (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title      text NOT NULL DEFAULT '',
  body       text NOT NULL DEFAULT '',
  is_pinned  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.strategy_discussion_replies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid NOT NULL REFERENCES public.strategy_discussions (id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body          text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_strategy_ratings_strategy ON public.strategy_ratings (strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_ratings_user ON public.strategy_ratings (user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_reviews_strategy ON public.strategy_reviews (strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_reviews_user ON public.strategy_reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_discussions_strategy ON public.strategy_discussions (strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_discussions_pinned ON public.strategy_discussions (strategy_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_discussion_replies_discussion ON public.strategy_discussion_replies (discussion_id, created_at);

-- Row Level Security
ALTER TABLE public.strategy_ratings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_reviews             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_discussions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_discussion_replies  ENABLE ROW LEVEL SECURITY;

CREATE POLICY strategy_ratings_select_all
  ON public.strategy_ratings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY strategy_ratings_manage_own
  ON public.strategy_ratings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY strategy_ratings_update_own
  ON public.strategy_ratings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY strategy_reviews_select_all
  ON public.strategy_reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY strategy_reviews_manage_own
  ON public.strategy_reviews FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY strategy_reviews_update_own
  ON public.strategy_reviews FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY strategy_discussions_select_all
  ON public.strategy_discussions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY strategy_discussions_manage_own
  ON public.strategy_discussions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY strategy_discussions_update_own
  ON public.strategy_discussions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY strategy_discussions_delete_own
  ON public.strategy_discussions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY strategy_discussion_replies_select_all
  ON public.strategy_discussion_replies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY strategy_discussion_replies_manage_own
  ON public.strategy_discussion_replies FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY strategy_discussion_replies_update_own
  ON public.strategy_discussion_replies FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY strategy_discussion_replies_delete_own
  ON public.strategy_discussion_replies FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Grants
GRANT SELECT ON public.strategy_ratings            TO authenticated;
GRANT SELECT ON public.strategy_reviews            TO authenticated;
GRANT SELECT ON public.strategy_discussions        TO authenticated;
GRANT SELECT ON public.strategy_discussion_replies TO authenticated;

GRANT ALL ON public.strategy_ratings            TO service_role;
GRANT ALL ON public.strategy_reviews            TO service_role;
GRANT ALL ON public.strategy_discussions        TO service_role;
GRANT ALL ON public.strategy_discussion_replies TO service_role;

-- Comments
COMMENT ON TABLE public.strategy_ratings IS
  'One rating (1-5) per user per strategy. Aggregate via AVG/COUNT queries.';

COMMENT ON TABLE public.strategy_reviews IS
  'Written reviews with rating, title, and body. One per user per strategy.';

COMMENT ON TABLE public.strategy_discussions IS
  'Community discussion threads per strategy. Creators can pin important topics.';

COMMENT ON TABLE public.strategy_discussion_replies IS
  'Replies to strategy discussion threads.';
