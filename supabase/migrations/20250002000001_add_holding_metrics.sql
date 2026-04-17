-- Quick wins: holding-level metrics (additive, nullable)
-- last_change_pct: from nightly quote changePercent (e.g. 1.25 = +1.25%)
-- expense_ratio: decimal fraction e.g. 0.0003 = 0.03% annual expense
-- target_weight_pct: user target as percentage e.g. 20.0 = 20% of portfolio

alter table public.portfolio_holdings
  add column if not exists last_change_pct numeric(8, 4),
  add column if not exists expense_ratio numeric(8, 6),
  add column if not exists target_weight_pct numeric(6, 2);

comment on column public.portfolio_holdings.last_change_pct is
  'Session / 1d change percent from market data provider (nightly refresh)';
comment on column public.portfolio_holdings.expense_ratio is
  'User-entered expense ratio as decimal fraction (0.0003 = 0.03%)';
comment on column public.portfolio_holdings.target_weight_pct is
  'User-entered target allocation percent for this line (20 = 20%)';
