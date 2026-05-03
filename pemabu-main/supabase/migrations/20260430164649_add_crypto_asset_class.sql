/*
  # Add crypto asset class to portfolio_holdings

  1. Changes
    - Drops existing `portfolio_holdings_asset_class_check` constraint
    - Re-creates it with 'crypto' added to the allowed values
    - Allowed values: equity, fixed_income, alternatives, cash, other, crypto

  2. Notes
    - Backward compatible — existing rows are unaffected
    - No data migration required; crypto is a new additive value
*/

ALTER TABLE public.portfolio_holdings
  DROP CONSTRAINT IF EXISTS portfolio_holdings_asset_class_check;

ALTER TABLE public.portfolio_holdings
  ADD CONSTRAINT portfolio_holdings_asset_class_check
  CHECK (asset_class IN ('equity','fixed_income','alternatives','cash','other','crypto'));
