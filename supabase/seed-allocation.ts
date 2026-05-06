/**
 * Allocation Intelligence v3.2 — Demo Portfolio Seed
 *
 * Seeds the "SK_Fidelity Demo" portfolio with exact values from the
 * Allocation_Intelligence_Model_v3_2.xlsx spreadsheet:
 *   - Sleeve 1: Main ETF (COMPOSITE_SCORE, 88%, APPRECIATION) — 100 holdings
 *   - Sleeve 2: Income (YIELD_PROPORTIONAL, 12%, INCOME) — 9 holdings
 *   - Sleeve 3: Fidelity/Cash (MANUAL, 0%, STABILITY) — 6 holdings
 *   - ModelAssumptions (v3.2 defaults)
 *
 * Run with: npx ts-node --project tsconfig.json supabase/seed-allocation.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ── Active holdings (60) — exact values from Universe sheet ──────────
// [ticker, name, theme, qty, priceSeed, expenseRatio, divDollar]

const ACTIVE_HOLDINGS = [
  ["SPDW",  "State Street SPDR Portfolio Devt World ex-US ETF",         "Intl",           0.863, 49.01,  0.0003, 1.26],
  ["VXUS",  "Vanguard Total International Stock Index Fund ETF",         "Intl",           0.252, 83.11,  0.0005, 0.6],
  ["VEU",   "Vanguard FTSE All World ex US ETF",                         "Intl",           0.259, 81.05,  0.0007, 0.58],
  ["IDV",   "iShares International Select Dividend ETF",                 "Intl",           0.962, 44.48,  0.005,  1.87],
  ["IEMG",  "iShares Core MSCI Emerging Markets ETF",                    "Intl",           0.541, 78.78,  0.0009, 1],
  ["FDD",   "First Trust STOXX European Select Dividend Idx Fd",         "Intl",           2.174, 19.11,  0.0059, 1.51],
  ["AVDE",  "Avantis International Equity ETF",                          "Intl",           0.448, 89.59,  0.0023, 0.98],
  ["SLVP",  "iShares MSCI Global Silver and Metals Miners ETF",          "Commodities",    1.11,  35.46,  0.0039, 0.67],
  ["GVAL",  "Cambria Global Value ETF",                                  "Intl",           1.183, 35.08,  0.0066, 1.08],
  ["VWO",   "Vanguard Emerging Markets Stock Index Fund ETF",            "Intl",           0.349, 59.07,  0.0007, 0.52],
  ["VYM",   "Vanguard High Dividend Yield Index Fund ETF",               "Dividend",       0.256, 156.88, 0.0006, 0.89],
  ["VTV",   "Vanguard Value Index Fund ETF",                             "US-Value",       0.193, 206.38, 0.0004, 0.75],
  ["VT",    "Vanguard Total World Stock Index Fund ETF",                 "Global",         0.339, 151.82, 0.0006, 0.87],
  ["XMVM",  "Invesco S and P MidCap Value with Momentum ETF",            "US-Mid",         0.577, 69.9,   0.0039, 0.76],
  ["VTWO",  "Vanguard Russell 2000 Index Fund ETF",                      "US-Small",       0.359, 112.92, 0.0007, 0.44],
  ["ILCV",  "iShares Morningstar Value ETF",                             "US-Value",       0.397, 99.51,  0.0004, 0.66],
  ["QTUM",  "Defiance Quantum ETF",                                      "Tech",           0.34,  135.26, 0.004,  0.38],
  ["IVV",   "iShares Core S&P 500 ETF",                                 "US-LargeCap",    0.055, 726.3,  0.0003, 0.44],
  ["VB",    "Vanguard Small-Cap Index Fund ETF",                         "US-Small",       0.109, 285.31, 0.0005, 0.37],
  ["VEA",   "Vanguard Tax Managed Fund FTSE Developed Markets ETF",      "Intl",           0.597, 68.88,  0.0003, 1.19],
  ["SIXG",  "Defiance AI & Connective Tech ETF",                         "Tech",           0.585, 81.26,  0.003,  0.2],
  ["SPTM",  "State Street SPDR Prft S&P 1500 Comp Stk Mkt ETF",         "US-Broad",       0.464, 87.74,  0.0003, 0.43],
  ["VOO",   "Vanguard S&P 500 ETF",                                      "US-LargeCap",    0.061, 664.59, 0.0003, 0.43],
  ["SMH",   "VanEck Semiconductor ETF",                                  "Tech",           0.103, 510.41, 0.0035, 0.11],
  ["PAVE",  "Global X U.S. Infra Developments UCITS ETF USD Acc",        "Infrastructure", 0.098, 52.85,  0.0047, 0.04],
  ["LEGR",  "First Trust Indxx Innovative Transactn & Proc ETF",         "Tech",           0.621, 62.88,  0.0065, 0.67],
  ["ITOT",  "iShares Core S&P Total US Stock Market ETF",                "US-Broad",       0.253, 158.23, 0.0003, 0.41],
  ["VTI",   "Vanguard Total Stock Market Index Fund ETF",                "US-Broad",       0.113, 356.3,  0.0003, 0.42],
  ["IWM",   "iShares Russell 2000 ETF",                                  "US-Small",       0.131, 279.48, 0.0019, 0.33],
  ["SCHB",  "Schwab US Broad Market ETF",                                "US-Broad",       1.444, 27.9,   0.0003, 0.42],
  ["XLK",   "State Street Technology Select Sector SPDR ETF",            "Tech",           0.267, 162.09, 0.0008, 0.2],
  ["FTXL",  "First Trust Nasdaq Semiconductor ETF",                      "Tech",           0.288, 214.84, 0.006,  0.1],
  ["IUSG",  "iShares Core S&P US Growth ETF",                            "US-Growth",      0.228, 179.11, 0.0004, 0.2],
  ["CGDV",  "Capital Group Dividend Value ETF",                          "Dividend",       0.52,  46.7,   0.0076, 0.29],
  ["SCHK",  "Schwab 1000 Index ETF",                                     "US-Broad",       1.155, 34.8,   0.0003, 0.41],
  ["SPYV",  "State Street SPDR Portfolio S&P 500 Value ETF",             "US-Value",       0.155, 60.08,  0.0004, 0.15],
  ["SPYG",  "State Street SPDR Portfolio S&P 500 Growth ETF",            "US-Growth",      0.22,  113.33, 0.0004, 0.12],
  ["SCHX",  "Schwab US Large-Cap ETF",                                   "US-LargeCap",    1.04,  28.47,  0.0003, 0.3],
  ["DUSA",  "Davis Select US Equity ETF",                                "US-LargeCap",    0.544, 55.2,   0.0059, 0.26],
  ["AFOS",  "ARS Focused Opportunities Strategy ETF",                    "US-LargeCap",    1.049, 41.43,  0.0045, 0.1],
  ["FDRR",  "Fidelity Dividend ETF for Rising Rates",                    "Dividend",       0.375, 63.51,  0.0015, 0.5],
  ["BKLC",  "BNY Mellon US Large Cap Core Equity ETF",                   "US-LargeCap",    0.065, 138.35, 0,      0.08],
  ["VV",    "Vanguard Large-Cap Index Fund ETF",                         "US-LargeCap",    0.027, 332.38, 0.0004, 0.09],
  ["VGT",   "Vanguard Information Technology Index Fund ETF",            "Tech",           0.023, 105,    0.0009, 0.07],
  ["VOOG",  "Vanguard S&P 500 Growth Index Fund ETF",                    "US-Growth",      0.05,  78.69,  0.0007, 0.1],
  ["MGC",   "Vanguard Mega Cap Index Fund ETF",                          "US-LargeCap",    0.033, 264.48, 0.0007, 0.07],
  ["QQQJ",  "Invesco NASDAQ Next Gen 100 ETF",                           "Tech",           0.771, 40.49,  0.0068, 0.24],
  ["QQQ",   "Invesco QQQ Trust, Series 1",                               "Tech",           0.029, 674.86, 0.002,  0.08],
  ["XLC",   "State Street Com Svc Sel Sec SPDR ETF",                     "ComSvc",         0.188, 116.91, 0.0008, 0.24],
  ["ROBO",  "ROBO Global Robotics and Automation Index ETF",             "Tech",           0.068, 81.76,  0.0095, 0.01],
  ["SLV",   "iShares Silver Trust",                                      "Commodities",    0.192, 68.66,  0.005,  0],
  ["IBLC",  "iShares Blockchain and Tech ETF",                           "Crypto",         0.345, 45.96,  0.0047, 0.89],
  ["XLV",   "State Street Health Care Select Sector SPDR ETF",           "Healthcare",     0.055, 145.52, 0.0008, 0.13],
  ["STCE",  "Schwab Crypto Thematic ETF",                                "Crypto",         0.555, 66.67,  0.003,  0.65],
  ["BLKC",  "iShares Blockchain Technology UCITS ETF (Acc)",             "Crypto",         0.845, 12.76,  0.006,  1.08],
  ["BKCH",  "Global X Blockchain ETF",                                   "Crypto",         0.487, 75.11,  0.005,  0.62],
  ["FDIG",  "Fidelity Crypto Industry and Digital Payments ETF",         "Crypto",         0.503, 40.7,   0.004,  0.22],
  ["VERS",  "ProShares Metaverse ETF",                                   "Tech",           0.627, 67.84,  0.0058, 0.2],
  ["BLOK",  "Amplify Blockchain Technology ETF",                         "Crypto",         0.607, 60.45,  0.0073, 0.24],
  ["BITQ",  "Bitwise Crypto Industry Innovators ETF",                    "Crypto",         0.987, 24.36,  0.0085, 0],
] as const;

// ── Comparable holdings (40) — exact values from Universe sheet ───────
// [ticker, name, theme, expenseRatio]  qty=0, divDollar=0, priceSeed=0

const COMPARABLE_HOLDINGS = [
  ["SCHV",  "Schwab US Large-Cap Value ETF",                             "Broad", 0.0004],
  ["IEFA",  "iShares Core MSCI EAFE ETF",                               "Broad", 0.0007],
  ["SPMD",  "State Street SPDR Portfolio S&P 400 Mid Cap ETF",          "Broad", 0.0003],
  ["IJR",   "iShares Core S&P Small-Cap ETF",                           "Broad", 0.0006],
  ["VPU",   "Vanguard Utilities Index Fund ETF",                        "Broad", 0.0009],
  ["QVAL",  "Alpha Architect US Quantitative Value ETF",                 "Broad", 0.0029],
  ["BSVO",  "EA Bridgeway Omni Small-Cap Value ETF",                    "Broad", 0.0045],
  ["IJH",   "iShares Core S&P Mid-Cap ETF",                             "Broad", 0.0005],
  ["MGV",   "Vanguard Mega Cap Value Index Fund ETF",                    "Broad", 0.0007],
  ["SCHD",  "Schwab US Dividend Equity ETF",                            "Broad", 0.0006],
  ["IMCB",  "iShares Morningstar Mid-Cap ETF",                          "Broad", 0.0004],
  ["DGRO",  "iShares Core Dividend Growth ETF",                         "Broad", 0.0008],
  ["IUSV",  "iShares Core S&P US Value ETF",                            "Broad", 0.0004],
  ["DJD",   "Invesco Dow Jones Industrial Average Div ETF",             "Broad", 0.0007],
  ["ILCG",  "iShares Morningstar Growth ETF",                           "Broad", 0.0004],
  ["QQMG",  "Invesco ESG NASDAQ 100 ETF",                               "Broad", 0.002],
  ["SPY",   "State Street SPDR S&P 500 ETF Trust",                      "Broad", 0.00095],
  ["WGMI",  "CoinShares Bitcoin Mining ETF",                            "Broad", 0.0075],
  ["VUG",   "Vanguard Growth Index Fund ETF",                           "Broad", 0.0004],
  ["VIG",   "Vanguard Dividend Appreciation Index Fund ETF",            "Broad", 0.0005],
  ["QQQM",  "Invesco NASDAQ 100 ETF",                                   "Broad", 0.0068],
  ["ARKQ",  "ARK Autonomous Technology & Robotics ETF",                 "Broad", 0.0075],
  ["SCHG",  "Schwab US Large-Cap Growth ETF",                           "Broad", 0.0004],
  ["FDVV",  "Fidelity High Dividend ETF",                               "Broad", 0.0016],
  ["USMC",  "Principal US Mega-Cap ETF",                                "Broad", 0.0012],
  ["VONG",  "Vanguard Russell 1000 Growth Index Fund ETF",              "Broad", 0.0007],
  ["MPLY",  "Monopoly ETF",                                             "Broad", 0.0005],
  ["VEGN",  "US Vegan Climate ETF",                                     "Broad", 0.006],
  ["DIA",   "State Street SPDR Dow Jones Indust Avg ETF Trust",         "Broad", 0.0016],
  ["XLF",   "State Street Financial Sel Sec SPDR ETF",                  "Broad", 0.0008],
  ["FDIS",  "Fidelity MSCI Consumer Discretionary Index ETF",           "Broad", 0.00084],
  ["IWF",   "iShares Russell 1000 Growth",                              "Broad", 0.0018],
  ["AIQ",   "Global X Artificial Intelligence & Technology ETF",        "Broad", 0.0068],
  ["XLSR",  "State Street SPDR SSGA US Sector Rotation ETF",            "Broad", 0.007],
  ["DAPP",  "VanEck Digital Transformation ETF",                        "Broad", 0.0051],
  ["BUZZ",  "VanEck Social Sentiment ETF",                              "Broad", 0.0076],
  ["ARKK",  "ARK Innovation UCITS ETF USD Acc",                         "Broad", 0.0075],
  ["FDG",   "American Century Focused Dynamic Growth ETF",              "Broad", 0.0045],
  ["ILDR",  "First Trust Innovation Leaders ETF",                       "Broad", 0.0075],
  ["QQH",   "HCM Defender 100 Index ETF",                               "Broad", 0.0098],
] as const;

// ── Income holdings (9) — exact values from Income sheet ─────────────
// [ticker, name, qty, priceSeed, divDollar]
// divDollar = total annual dividend $ for the position (= divAPY × value)
// expenseRatio not provided in Income sheet — set to 0

const INCOME_HOLDINGS = [
  ["CCNR",  "ALPS CoreCommodity Natural Resources ETF",            0.703, 41.09,  0.8],
  ["DIVO",  "Amplify CWP Enhanced Dividend Income ETF",            0.547, 45.72,  1.66],
  ["FYEE",  "Fidelity Yield Enhanced Equity ETF",                  0.863, 28.88,  1.75],
  ["GPIX",  "Goldman Sachs S&P 500 Premium Income ETF",            0.47,  53.99,  2],
  ["IAUI",  "NEOS Gold High Income ETF",                           0.43,  56.21,  1.91],
  ["IDVO",  "Amplify CWP International Enhanced Div Inc ETF",      0.635, 42.3,   1.45],
  ["IQQQ",  "ProShares Nasdaq-100 High Income ETF",                0.576, 47.09,  2.54],
  ["JEPQ",  "JPMorgan Nasdaq Equity Premium Income ETF",           0.422, 58.85,  2.58],
  ["KGLD",  "Kurv Gold Enhanced Income ETF",                       0.788, 31.46,  1.33],
] as const;

// ── Fidelity / Cash holdings (6) — exact values from Fidelity sheet ──
// Fidelity mutual funds: manual_pricing=true, value = current balance
// Using priceSeed=1.00 so qty×price = dollar value
// [ticker, name, dollarValue, expenseRatio, manualTargetWt]

const FIDELITY_HOLDINGS = [
  ["Cash",  "Cash",                                1731.03, 0,      0.35],
  ["FSKAX", "Fidelity Total Market Index Fund",     308.65, 0.0002, 0.06],
  ["FSMDX", "Fidelity Mid Cap Index Fund",          323.95, 0.00025,0.06],
  ["FTIHX", "Fidelity Total International Index Fund", 345.51, 0.0002, 0.06],
  ["FXAIX", "Fidelity 500 Index Fund",              307.63, 0.0002, 0.06],
  ["FXNAX", "Fidelity U.S. Bond Index Fund",        125.55, 0.0002, 0.025],
] as const;

// ── Seed function ─────────────────────────────────────────────────────

async function seed() {
  console.log("Seeding Allocation Intelligence v3.2 demo portfolio...");

  // Find or create demo user — use the first user in the system
  const { data: users, error: usersErr } = await supabase.auth.admin.listUsers();
  if (usersErr || !users?.users?.length) {
    throw new Error("No users found. Create a user account first.");
  }
  const userId = users.users[0]!.id;
  console.log(`Using user: ${userId}`);

  // Create portfolio
  const { data: portfolio, error: portfolioErr } = await supabase
    .from("portfolios")
    .insert({ user_id: userId, name: "SK_Fidelity Demo", description: "Allocation Intelligence v3.2 demo" })
    .select()
    .single();
  if (portfolioErr) throw portfolioErr;
  const portfolioId = (portfolio as { id: string }).id;
  console.log(`Created portfolio: ${portfolioId}`);

  // Create ModelAssumptions
  const { error: assErr } = await supabase.from("model_assumptions").insert({
    portfolio_id: portfolioId,
    ret_weight_3mo:    0.40,
    ret_weight_6mo:    0.25,
    ret_weight_1yr:    0.20,
    ret_weight_3yr:    0.10,
    ret_weight_5yr:    0.05,
    score_weight_exp:  0.30,
    score_weight_ret:  0.30,
    score_weight_div:  0.15,
    score_weight_shp:  0.25,
    income_budget_pct: 0.12,
    vol_cap_multiplier: 3.0,
    theme_cap_pct:     0.10,
  });
  if (assErr) throw assErr;
  console.log("Created ModelAssumptions");

  // ── Sleeve 1: Main ETF ──────────────────────────────────────────────
  const { data: mainSleeve, error: mainErr } = await supabase
    .from("sleeves")
    .insert({
      portfolio_id:     portfolioId,
      name:             "Main ETF",
      purpose:          "Appreciation",
      weighting_method: "COMPOSITE_SCORE",
      budget_pct:       0.88,
      sort_order:       0,
      is_active:        true,
    })
    .select()
    .single();
  if (mainErr) throw mainErr;
  const mainSleeveId = (mainSleeve as { id: string }).id;

  // Active holdings
  const activeRows = ACTIVE_HOLDINGS.map(
    ([ticker, name, theme, qty, priceSeed, expenseRatio, divDollar], i) => ({
      sleeve_id:     mainSleeveId,
      ticker,
      name,
      status:        "Active",
      theme,
      qty,
      price_seed:    priceSeed,
      expense_ratio: expenseRatio,
      div_dollar:    divDollar,
      manual_pricing: false,
      sort_order:    i,
    }),
  );

  // Comparable holdings (qty=0, price_seed=0, div_dollar=0)
  const comparableRows = COMPARABLE_HOLDINGS.map(([ticker, name, theme, expenseRatio], i) => ({
    sleeve_id:     mainSleeveId,
    ticker,
    name,
    status:        "Comparable",
    theme,
    qty:           0,
    price_seed:    0,
    expense_ratio: expenseRatio,
    div_dollar:    0,
    manual_pricing: false,
    sort_order:    ACTIVE_HOLDINGS.length + i,
  }));

  const { error: holdingsErr } = await supabase
    .from("sleeve_holdings")
    .insert([...activeRows, ...comparableRows]);
  if (holdingsErr) throw holdingsErr;
  console.log(`Created ${activeRows.length} active + ${comparableRows.length} comparable main ETF holdings`);

  // ── Sleeve 2: Income ─────────────────────────────────────────────────
  const { data: incomeSleeve, error: incomeErr } = await supabase
    .from("sleeves")
    .insert({
      portfolio_id:     portfolioId,
      name:             "Income",
      purpose:          "Income",
      weighting_method: "YIELD_PROPORTIONAL",
      budget_pct:       0.12,
      sort_order:       1,
      is_active:        true,
    })
    .select()
    .single();
  if (incomeErr) throw incomeErr;
  const incomeSleeveId = (incomeSleeve as { id: string }).id;

  const incomeRows = INCOME_HOLDINGS.map(([ticker, name, qty, priceSeed, divDollar], i) => ({
    sleeve_id:     incomeSleeveId,
    ticker,
    name,
    status:        "Active",
    theme:         "Dividend",
    qty,
    price_seed:    priceSeed,
    expense_ratio: 0,
    div_dollar:    divDollar,
    manual_pricing: false,
    sort_order:    i,
  }));

  const { error: incomeHoldingsErr } = await supabase.from("sleeve_holdings").insert(incomeRows);
  if (incomeHoldingsErr) throw incomeHoldingsErr;
  console.log(`Created ${incomeRows.length} income sleeve holdings`);

  // ── Sleeve 3: Fidelity/Cash ──────────────────────────────────────────
  const { data: fidelitySleeve, error: fidelityErr } = await supabase
    .from("sleeves")
    .insert({
      portfolio_id:     portfolioId,
      name:             "Fidelity/Cash",
      purpose:          "Stability",
      weighting_method: "MANUAL",
      budget_pct:       0,
      sort_order:       2,
      is_active:        true,
    })
    .select()
    .single();
  if (fidelityErr) throw fidelityErr;
  const fidelitySleeveId = (fidelitySleeve as { id: string }).id;

  // Fidelity mutual funds: priceSeed=1.00, qty=dollarValue so qty×price = $balance
  const fidelityRows = FIDELITY_HOLDINGS.map(
    ([ticker, name, dollarValue, expenseRatio, manualTargetWt], i) => ({
      sleeve_id:       fidelitySleeveId,
      ticker,
      name,
      status:          "Active",
      theme:           "Broad",
      qty:             dollarValue,
      price_seed:      1.0,
      expense_ratio:   expenseRatio,
      div_dollar:      0,
      manual_pricing:  true,
      manual_target_wt: manualTargetWt,
      sort_order:      i,
    }),
  );

  const { error: fidelityHoldingsErr } = await supabase.from("sleeve_holdings").insert(fidelityRows);
  if (fidelityHoldingsErr) throw fidelityHoldingsErr;
  console.log(`Created ${fidelityRows.length} Fidelity/Cash sleeve holdings`);

  console.log("\nSeed complete!");
  console.log(`Portfolio ID:          ${portfolioId}`);
  console.log(`Main ETF sleeve ID:    ${mainSleeveId}`);
  console.log(`Income sleeve ID:      ${incomeSleeveId}`);
  console.log(`Fidelity/Cash sleeve:  ${fidelitySleeveId}`);
  console.log('\nNext step: visit /portfolio/sleeves and click "Refresh Prices" to populate snapshots.');
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
