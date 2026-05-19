export const DEMO_WALLETS = [
  {
    id: "demo-wallet-1",
    user_id: "demo",
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    chain: "ethereum" as const,
    label: "Demo Main Wallet",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-wallet-2",
    user_id: "demo",
    address: "F4Sz8dTnQxsy2EMGgHhYQmth3qFkGNyvAT",
    chain: "solana" as const,
    label: "Demo Solana Wallet",
    created_at: new Date().toISOString(),
  },
];

export const DEMO_POSITIONS = [
  { wallet_id: "demo-wallet-1", address: "0x71C7…", chain: "ethereum", asset_symbol: "ETH", asset_name: "Ethereum", balance: 4.2, usd_value: 14280, position_type: "native" as const, protocol: null },
  { wallet_id: "demo-wallet-1", address: "0x71C7…", chain: "ethereum", asset_symbol: "USDC", asset_name: "USD Coin", balance: 25000, usd_value: 25000, position_type: "token" as const, protocol: null },
  { wallet_id: "demo-wallet-1", address: "0x71C7…", chain: "ethereum", asset_symbol: "UNI-V2", asset_name: "Uniswap V2 ETH/USDC", balance: 120.5, usd_value: 8450, position_type: "lp" as const, protocol: "Uniswap", lp_token_a: "ETH", lp_token_b: "USDC", lp_value_a: 4200, lp_value_b: 4250, impermanent_loss_pct: -0.023 },
  { wallet_id: "demo-wallet-2", address: "F4Sz…", chain: "solana", asset_symbol: "SOL", asset_name: "Solana", balance: 85, usd_value: 11900, position_type: "native" as const, protocol: null },
  { wallet_id: "demo-wallet-2", address: "F4Sz…", chain: "solana", asset_symbol: "mSOL", asset_name: "Marinade Staked SOL", balance: 42, usd_value: 5880, position_type: "staking" as const, protocol: "Marinade" },
];

export const DEMO_GOVERNANCE_PROPOSALS = [
  { id: "demo-prop-1", token_ticker: "UNI", title: "Uniswap Fee Switch Proposal — Enable Protocol Fee on ETH Pairs", plain_english_summary: "This proposal asks UNI holders to turn on a 10% protocol fee on ETH-denominated swaps. Revenue would flow to the UNI treasury. This is a significant change that could reduce LP yields but increase protocol sustainability.", state: "active", vote_deadline: new Date(Date.now() + 3 * 86400000).toISOString(), votes_for: 42000000, votes_against: 15000000, votes_abstain: 500000, quorum_required: 40000000, url: "https://snapshot.org/#/uniswap" },
  { id: "demo-prop-2", token_ticker: "AAVE", title: "Aave V3 Deployment on Base — Risk Parameters Update", plain_english_summary: "A routine governance proposal to adjust LTV and liquidation thresholds for wETH and USDC on the Base deployment of Aave V3. These adjustments align with observed market conditions.", state: "active", vote_deadline: new Date(Date.now() + 5 * 86400000).toISOString(), votes_for: 850000, votes_against: 120000, votes_abstain: 30000, quorum_required: 700000, url: "https://snapshot.org/#/aave.eth" },
  { id: "demo-prop-3", token_ticker: "COMP", title: "Compound Treasury Rate Adjustment — Increase USDC Supply Cap", plain_english_summary: "A parameter adjustment to raise the USDC supply cap on Compound v3 from $200M to $300M to accommodate growing demand. Standard risk parameter change.", state: "closed", vote_deadline: new Date(Date.now() - 1 * 86400000).toISOString(), votes_for: 3200000, votes_against: 400000, votes_abstain: 100000, quorum_required: 2500000, url: "https://snapshot.org/#/comp-vote.eth" },
];

export const DEMO_OPTIONS_POSITIONS = [
  { id: "demo-opt-1", user_id: "demo", portfolio_id: "", underlying_ticker: "AAPL", option_type: "call" as const, strategy: "covered_call" as const, strike_price: 195, expiration_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), contracts: 5, premium_paid: 2.35, current_price: 1.85, delta: 0.42, notes: "Monthly income strategy", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "demo-opt-2", user_id: "demo", portfolio_id: "", underlying_ticker: "SPY", option_type: "put" as const, strategy: "protective_put" as const, strike_price: 530, expiration_date: new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10), contracts: 3, premium_paid: 8.75, current_price: 6.2, delta: -0.28, notes: "Portfolio hedge for earnings season", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "demo-opt-3", user_id: "demo", portfolio_id: "", underlying_ticker: "TSLA", option_type: "call" as const, strategy: "long_call" as const, strike_price: 250, expiration_date: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10), contracts: 2, premium_paid: 12.5, current_price: 18.3, delta: 0.65, notes: "Directional bullish bet", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const DEMO_DISCLOSURES = [
  { id: "demo-disc-1", representative: "Nancy Pelosi", party: "D", state: "CA", ticker: "NVDA", asset_description: "NVIDIA Corporation", transaction_type: "purchase", amount_range: "$1,001 - $15,000", transaction_date: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), filed_at_date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), sentiment: "accumulating" as const, priorExposure: 250000, exposure: 265000 },
  { id: "demo-disc-2", representative: "Dan Crenshaw", party: "R", state: "TX", ticker: "VOO", asset_description: "Vanguard S&P 500 ETF", transaction_type: "purchase", amount_range: "$15,001 - $50,000", transaction_date: new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10), filed_at_date: new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10), sentiment: "accumulating" as const, priorExposure: 500000, exposure: 540000 },
  { id: "demo-disc-3", representative: "Josh Gottheimer", party: "D", state: "NJ", ticker: "MSFT", asset_description: "Microsoft Corporation", transaction_type: "sale", amount_range: "$100,001 - $250,000", transaction_date: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10), filed_at_date: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10), sentiment: "decreasing" as const, priorExposure: 750000, exposure: 600000 },
] as const;
