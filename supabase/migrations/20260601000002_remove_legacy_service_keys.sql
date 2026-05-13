-- Remove legacy service keys that are not part of the canonical catalog
-- Safe: only deletes rows with no active user_subscriptions referencing them

delete from public.pemabu_services
where service_key not in (
  'core_v1',
  'intelligence_annual',
  'autonomous_annual',
  'scenario_sim_overage',
  'v1_to_v2_upgrade',
  'addon_defi_onchain',
  'addon_macro_intelligence',
  'addon_options_overlay',
  'addon_family_sharing',
  'addon_data_vault_export',
  'addon_governance_alerts',
  'addon_political_tracker',
  'addon_token_quality',
  'live_broadcast_addon'
)
and service_key not in (
  -- Protect any legacy key that still has active user subscriptions
  -- so we do not break FK integrity on existing user data
  select distinct service_key
  from public.user_subscriptions
  where status in ('active', 'complimentary', 'trial')
);
