alter table public.portfolio_holdings
  add column if not exists expense_ratio numeric,
  add column if not exists dividend_dollars numeric,
  add column if not exists target_parity_weight numeric,
  add column if not exists price_current numeric,
  add column if not exists price_24h_basis numeric,
  add column if not exists price_7d_basis numeric,
  add column if not exists basis_price_3mo numeric,
  add column if not exists basis_price_6mo numeric,
  add column if not exists basis_price_1yr numeric,
  add column if not exists basis_price_3yr numeric,
  add column if not exists basis_price_5yr numeric,
  add column if not exists volatility_3mo numeric,
  add column if not exists rsi_14 numeric,
  add column if not exists last_market_refresh timestamptz,
  add column if not exists change_24h numeric,
  add column if not exists change_7d numeric,
  add column if not exists return_3mo numeric,
  add column if not exists return_6mo numeric,
  add column if not exists return_1yr numeric,
  add column if not exists return_3yr numeric,
  add column if not exists return_5yr numeric,
  add column if not exists return_avg numeric,
  add column if not exists return_weighted_avg numeric,
  add column if not exists market_value numeric,
  add column if not exists current_weight numeric,
  add column if not exists div_apy numeric,
  add column if not exists sub_rank_current integer,
  add column if not exists sub_rank_expense integer,
  add column if not exists sub_rank_weighted_ret integer,
  add column if not exists sub_rank_div_apy integer,
  add column if not exists sub_rank_volatility integer,
  add column if not exists sub_rank_vol_signed integer,
  add column if not exists composite_score numeric,
  add column if not exists rank_overall integer,
  add column if not exists alert_primary text,
  add column if not exists alert_secondary text,
  add column if not exists target_sleeve_pct numeric,
  add column if not exists parity_dollars numeric,
  add column if not exists parity_change_dollars numeric,
  add column if not exists shares_delta numeric;

create table if not exists public.portfolio_assumptions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  weight_3mo numeric not null default 0.40,
  weight_6mo numeric not null default 0.25,
  weight_1yr numeric not null default 0.20,
  weight_3yr numeric not null default 0.10,
  weight_5yr numeric not null default 0.05,
  factor_expense numeric not null default 0.30,
  factor_pct_weight numeric not null default 0.30,
  factor_div_apy numeric not null default 0.15,
  factor_volatility numeric not null default 0.25,
  updated_at timestamptz default now(),
  unique (portfolio_id)
);

alter table public.portfolio_assumptions enable row level security;

drop policy if exists "owner access" on public.portfolio_assumptions;
create policy "owner access"
  on public.portfolio_assumptions
  for all
  using (
    portfolio_id in (
      select id from public.portfolios where user_id = auth.uid()
    )
  )
  with check (
    portfolio_id in (
      select id from public.portfolios where user_id = auth.uid()
    )
  );
