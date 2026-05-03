import Link from "next/link";

const DISCLAIMER =
  "This is educational information only. Crypto is highly volatile and speculative. This is not financial advice.";

const ACCUMULATION_STRATEGIES = [
  {
    title: "Dollar-Cost Averaging (DCA)",
    desc: "Fixed schedule buying at regular intervals regardless of price. Smooths volatility over time and removes emotional decision-making from entry points.",
  },
  {
    title: "Value Averaging",
    desc: "Adjust purchase size each period to hit a fixed portfolio growth target. Buy more when prices drop, less when prices rise — enforces disciplined accumulation.",
  },
  {
    title: "Bear Market Accumulation",
    desc: "Tranched deployment at pre-defined support levels. Deploy capital in 20-25% increments as price reaches successive drawdown thresholds.",
  },
  {
    title: "Core + Satellite Model",
    desc: "BTC/ETH as 60-70% core holdings for stability. Altcoins as 30-40% satellite positions for higher growth potential with defined risk budgets.",
  },
];

const INCOME_STRATEGIES = [
  {
    title: "Staking",
    desc: "ETH ~3-4% APY, SOL/AVAX 5-10%. Liquid staking via stETH/rETH maintains liquidity while earning protocol rewards.",
  },
  {
    title: "Lending Protocols",
    desc: "Aave, Compound — variable 3-8% on stablecoins. Earn interest by supplying assets to decentralized money markets.",
  },
  {
    title: "Liquidity Provision",
    desc: "DEX pools with impermanent loss risk. Curve stablecoin pools as a conservative option with lower IL exposure and steady fee income.",
  },
  {
    title: "Covered Options / Structured Products",
    desc: "Ribbon, Thetanuts — 10-25% APY. Automated covered call strategies that cap upside in exchange for premium income.",
  },
  {
    title: "Real Yield Protocols",
    desc: "GMX, dYdX, Gains Network — revenue sharing not token emissions. Earn a share of actual protocol fees rather than inflationary rewards.",
  },
];

const APPRECIATION_STRATEGIES = [
  {
    title: "Bitcoin as Digital Gold",
    desc: "Fixed supply of 21M. Halving cycle drives supply shocks. Growing institutional adoption via ETFs. Cold storage for long-term conviction holds.",
  },
  {
    title: "Ethereum Ecosystem",
    desc: "PoS + EIP-1559 creates deflationary pressure. L2 expansion via Arbitrum, Base, Optimism drives network usage and fee revenue.",
  },
  {
    title: "L1/L2 Alpha",
    desc: "Solana, Aptos, Sui, zkSync, Celestia, EigenLayer — higher risk/reward frontier. Early positioning in next-generation infrastructure.",
  },
  {
    title: "Narrative Rotation",
    desc: "DeFi → NFTs → L2s → AI+crypto → RWAs — cycle-aware positioning. Identify emerging narratives early and rotate before peak euphoria.",
  },
  {
    title: "Early-Stage Tokens",
    desc: "IDOs, token launches — highest risk category. Requires deep vesting/tokenomics research, small position sizes, and acceptance of total loss scenarios.",
  },
];

const FRAMEWORK_TABLE = [
  {
    strategy: "BTC/ETH DCA",
    risk: "Medium",
    horizon: "3-10 years",
    bestFor: "Wealth preservation + growth",
  },
  {
    strategy: "Staking + Lending",
    risk: "Medium",
    horizon: "Ongoing",
    bestFor: "Passive income on holdings",
  },
  {
    strategy: "L1/L2 Rotation",
    risk: "High",
    horizon: "1-3 years",
    bestFor: "Cycle-based appreciation",
  },
  {
    strategy: "LP + Real Yield",
    risk: "Medium-High",
    horizon: "6-18 months",
    bestFor: "Active income",
  },
  {
    strategy: "Early-Stage Tokens",
    risk: "Very High",
    horizon: "6-24 months",
    bestFor: "Asymmetric upside",
  },
];

const RISK_PRINCIPLES = [
  "Never invest more than you can afford to lose entirely",
  "Use hardware wallets (Ledger, Trezor) for long-term holdings — not exchanges",
  "Diversify across chains and sectors, not just tokens",
  "Understand vesting schedules and token unlock events before buying altcoins",
  "Have a pre-defined exit strategy — greed is the #1 portfolio killer in crypto",
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 font-mono text-xs uppercase tracking-widest text-emerald-400">
      {children}
    </p>
  );
}

function StrategyCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-[#F7931A]/30 hover:bg-[#F7931A]/[0.03]">
      <h4 className="mb-2 text-sm font-medium text-white">{title}</h4>
      <p className="text-xs leading-relaxed text-gray-400">{desc}</p>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Medium: "border-emerald-500/30 text-emerald-400",
    "Medium-High": "border-amber-500/30 text-amber-400",
    High: "border-orange-500/30 text-orange-400",
    "Very High": "border-red-500/30 text-red-400",
  };
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs ${colors[level] ?? "border-gray-500/30 text-gray-400"}`}
    >
      {level}
    </span>
  );
}

export default function CryptoPage() {
  return (
    <div className="min-h-screen bg-[#0A1628]">
      {/* Hero */}
      <section className="px-6 pb-16 pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-block rounded-full border border-[#F7931A]/30 bg-[#F7931A]/10 px-4 py-1.5">
            <span className="font-mono text-xs tracking-wide text-[#F7931A]">
              DIGITAL ASSETS
            </span>
          </div>
          <h1 className="mb-6 text-4xl font-light tracking-wide text-white md:text-5xl">
            Crypto Allocation Intelligence
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-gray-400">
            Pemabu monitors crypto alongside traditional assets, detects allocation drift in your
            digital asset sleeve, and keeps your portfolio on target — whether you hold Bitcoin,
            Ethereum, DeFi positions, or emerging L1/L2 tokens.
          </p>
          <p className="mt-6 font-mono text-xs text-gray-600">{DISCLAIMER}</p>
        </div>
      </section>

      {/* Accumulation Strategies */}
      <section className="border-t border-white/5 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <SectionLabel>Accumulation Strategies</SectionLabel>
          <h2 className="mb-8 text-2xl font-light text-white">Building positions with discipline</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {ACCUMULATION_STRATEGIES.map((s) => (
              <StrategyCard key={s.title} title={s.title} desc={s.desc} />
            ))}
          </div>
        </div>
      </section>

      {/* Income Strategies */}
      <section className="border-t border-white/5 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <SectionLabel>Income Strategies</SectionLabel>
          <h2 className="mb-8 text-2xl font-light text-white">Generating yield on digital assets</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {INCOME_STRATEGIES.map((s) => (
              <StrategyCard key={s.title} title={s.title} desc={s.desc} />
            ))}
          </div>
        </div>
      </section>

      {/* Wealth Appreciation Strategies */}
      <section className="border-t border-white/5 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <SectionLabel>Wealth Appreciation Strategies</SectionLabel>
          <h2 className="mb-8 text-2xl font-light text-white">Long-term value creation</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {APPRECIATION_STRATEGIES.map((s) => (
              <StrategyCard key={s.title} title={s.title} desc={s.desc} />
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio Framework Table */}
      <section className="border-t border-white/5 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <SectionLabel>Portfolio Framework</SectionLabel>
          <h2 className="mb-8 text-2xl font-light text-white">Strategy comparison at a glance</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-5 py-3 text-left font-mono text-xs font-normal uppercase tracking-wider text-gray-500">
                    Strategy
                  </th>
                  <th className="px-5 py-3 text-left font-mono text-xs font-normal uppercase tracking-wider text-gray-500">
                    Risk Level
                  </th>
                  <th className="px-5 py-3 text-left font-mono text-xs font-normal uppercase tracking-wider text-gray-500">
                    Time Horizon
                  </th>
                  <th className="px-5 py-3 text-left font-mono text-xs font-normal uppercase tracking-wider text-gray-500">
                    Best For
                  </th>
                </tr>
              </thead>
              <tbody>
                {FRAMEWORK_TABLE.map((row, i) => (
                  <tr
                    key={row.strategy}
                    className={i < FRAMEWORK_TABLE.length - 1 ? "border-b border-white/5" : ""}
                  >
                    <td className="px-5 py-4 text-sm font-medium text-white">{row.strategy}</td>
                    <td className="px-5 py-4">
                      <RiskBadge level={row.risk} />
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-gray-400">{row.horizon}</td>
                    <td className="px-5 py-4 text-xs text-gray-400">{row.bestFor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 font-mono text-xs text-gray-600">{DISCLAIMER}</p>
        </div>
      </section>

      {/* Risk Management Principles */}
      <section className="border-t border-white/5 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <SectionLabel>Risk Management Principles</SectionLabel>
          <h2 className="mb-8 text-2xl font-light text-white">Non-negotiable rules for digital assets</h2>
          <div className="space-y-4">
            {RISK_PRINCIPLES.map((principle, i) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-lg border border-white/10 bg-white/[0.02] px-5 py-4"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#F7931A]/30 font-mono text-xs text-[#F7931A]">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-gray-300">{principle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — How Pemabu Helps */}
      <section className="border-t border-white/5 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>How Pemabu Helps</SectionLabel>
          <h2 className="mb-6 text-2xl font-light text-white">
            The same intelligence, applied to crypto
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-gray-400">
            Pemabu&apos;s drift detection, RSI signals, and composite scoring work for crypto the
            same way they work for equities. Track your digital asset sleeve against its target
            allocation, receive alerts when positions drift, and maintain portfolio discipline across
            all asset classes.
          </p>
          <Link
            href="/request-access"
            className="inline-block rounded-lg bg-emerald-500 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-400"
          >
            Request beta access
          </Link>
          <p className="mt-8 font-mono text-xs text-gray-600">{DISCLAIMER}</p>
        </div>
      </section>
    </div>
  );
}
