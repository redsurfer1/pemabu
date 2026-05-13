import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0A1628] px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-6 text-xs uppercase tracking-widest text-emerald-400">Pricing</p>
        <h1 className="mb-6 text-4xl font-light tracking-wide text-white">Pemabu revenue model</h1>
        <p className="mb-8 text-lg leading-relaxed text-gray-400">
          Pemabu does not offer a permanent free tier. New users may start with a 30-day, full-featured trial. Private
          beta participants receive every active catalog service at no charge for as long as beta membership stays
          active.
        </p>
      </div>

      <div className="mx-auto mb-16 max-w-2xl rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-10 text-center">
        <p className="mb-4 text-xs uppercase tracking-widest text-emerald-400">Private beta</p>
        <p className="mb-2 text-5xl font-light text-white">Complimentary</p>
        <p className="mb-8 text-sm text-gray-500">All active catalog services · no expiry while beta is active</p>
        <ul className="mx-auto mb-8 max-w-xs space-y-3 text-left">
          {[
            "Pemabu Core v1 engine access",
            "Pemabu Intelligence & Autonomous feature set",
            "Live Broadcast & Political Trade Tracker (included in paid Intelligence — bundled in beta)",
            "Scenario simulations (Autonomous = unlimited in GA)",
            "Admin dashboard & workbook tooling",
          ].map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm text-gray-300">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
              {feature}
            </li>
          ))}
        </ul>
        <Link
          href="/request-access"
          className="inline-block rounded-lg bg-emerald-500 px-8 py-3 text-sm text-white transition-colors hover:bg-emerald-400"
        >
          Request beta access
        </Link>
      </div>

      <div className="mx-auto mb-12 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.02] p-8">
        <h2 className="mb-4 text-center text-sm font-medium uppercase tracking-wider text-gray-400">
          Why Intelligence is the anchor tier
        </h2>
        <p className="mb-6 text-center text-xs text-gray-500">
          Core v1 ($199 one-time) plus the Live Broadcast add-on ($79/year) totals $278 in year one. Pemabu
          Intelligence ($229/year) already includes Live Broadcast, Political Trade Tracker, multi-account support,
          real-time feeds, and far more — so upgrading from Core is the rational default once you need live viewing.
        </p>
        <table className="w-full text-left text-sm text-gray-300">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-4">Bundle</th>
              <th className="py-2 text-right">Reference</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-white/5">
              <td className="py-3">Pemabu Core v1 + Live Broadcast add-on</td>
              <td className="py-3 text-right font-mono text-white">$199 + $79/yr → $278 Y1</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3">Pemabu Intelligence (annual)</td>
              <td className="py-3 text-right font-mono text-emerald-300">$229/yr (includes Live Broadcast)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mx-auto max-w-3xl space-y-10 text-left text-sm text-gray-300">
        <section className="rounded-2xl border border-white/10 p-8">
          <h2 className="mb-2 text-lg font-medium text-white">Pemabu Core v1</h2>
          <p className="mb-4 font-mono text-emerald-300">$199 one-time</p>
          <p className="leading-relaxed text-gray-400">
            Perpetual license for v1.x. Full local allocation engine, single portfolio, offline capable. All v1.x point
            releases free. Major version upgrade (v1 → v2) is a separate one-time fee. Live Broadcast is available as
            a $79/year add-on for Core-only users who need browser viewing.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 p-8">
          <h2 className="mb-2 text-lg font-medium text-white">Pemabu Intelligence</h2>
          <p className="mb-4 font-mono text-emerald-300">$229 / year</p>
          <p className="leading-relaxed text-gray-400">
            Multi-account (up to 10 portfolios), real-time price feeds, Watcher Agent (4-hour cycle), WebSocket Live
            Broadcast, political trade overlay, hedge fund 13F overlay, morning brief.{" "}
            <strong className="font-medium text-gray-300">20 simulations/month included.</strong> Additional
            simulations beyond the soft cap are <strong className="font-medium text-gray-300">$0.50 each.</strong>
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 p-8">
          <h2 className="mb-2 text-lg font-medium text-white">Pemabu Autonomous</h2>
          <p className="mb-4 font-mono text-emerald-300">$899 / year</p>
          <p className="leading-relaxed text-gray-400">
            Everything in Intelligence plus WebRTC P2P broadcast, fiat and crypto execution (Alpaca, Kraken, Coinbase),
            trade approval queue, configurable guardrails, immutable audit ledger, tax lot tracking, bidirectional
            browser control, emergency stop.{" "}
            <strong className="font-medium text-gray-300">Unlimited scenario simulations included.</strong> The $670
            delta vs Intelligence covers execution, compliance-grade logging, and automation depth. The immutable audit ledger is a tax and
            compliance feature: a complete append-only transaction ledger for your accountant or tax preparer, with
            pre-sorted realized gains and losses by tax lot.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 p-8">
          <h2 className="mb-2 text-lg font-medium text-white">Live Broadcast (add-on)</h2>
          <p className="mb-4 font-mono text-gray-300">$79 / year</p>
          <p className="leading-relaxed text-gray-400">
            WebSocket relay for Core-only customers who need a secure browser session to a single portfolio. Already
            bundled with Pemabu Intelligence and Pemabu Autonomous at no extra charge.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 p-8">
          <h2 className="mb-2 text-lg font-medium text-white">Add-ons (annual)</h2>
          <ul className="space-y-2 font-mono text-xs text-gray-400">
            <li>DeFi + On-Chain — $49</li>
            <li>Macro Intelligence — $39</li>
            <li>Options Overlay — $59</li>
            <li>Family Sharing — $49</li>
            <li>Data Vault Export — $19</li>
            <li>Governance Alert Layer — $39</li>
            <li>Political Trade Tracker — $29 (included with Intelligence & Autonomous)</li>
            <li>Token Quality Score — $29</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 p-8">
          <h2 className="mb-2 text-lg font-medium text-white">Other catalog items</h2>
          <ul className="space-y-2 text-xs text-gray-400">
            <li>Scenario Simulation (overage) — $0.50 per simulation beyond Intelligence&apos;s 20/month soft cap.</li>
          </ul>
        </section>

        <p className="text-center text-xs text-gray-600">
          Spots are limited. Beta access is by invitation only. Prices shown are the public catalog; active
          subscriptions are never repriced retroactively.
        </p>
        <div className="text-center">
          <Link href="/" className="text-xs text-emerald-400 hover:text-emerald-300">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
