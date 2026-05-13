import Link from "next/link";
import type { PemabuService } from "@/lib/types/database";
import { getCachedServices } from "@/lib/cache/service-catalog";

const ADDON_BUNDLES = [
  {
    name: "Data & Intelligence",
    description: "Market analysis, governance monitoring, and token scoring",
    keys: [
      "addon_macro_intelligence",
      "addon_governance_alerts",
      "addon_token_quality",
      "addon_political_tracker",
    ],
  },
  {
    name: "Execution & Safety",
    description: "On-chain monitoring, options tracking, and data portability",
    keys: ["addon_defi_onchain", "addon_options_overlay", "addon_data_vault_export"],
  },
  {
    name: "Sharing & Family",
    description: "Broadcast and read-only sharing for household portfolios",
    keys: ["addon_family_sharing", "live_broadcast_addon"],
  },
] as const;

async function getPricingData(): Promise<PemabuService[]> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/public/pricing`, { next: { revalidate: 600 } });
    if (res.ok) {
      const body = (await res.json()) as { data: PemabuService[] };
      return body.data ?? [];
    }
  } catch {
    /* build-time or no server — fall back to same catalog source */
  }
  try {
    const rows = await getCachedServices();
    return rows.filter((s) => s.is_active);
  } catch {
    return [];
  }
}

function pick(services: PemabuService[], key: string): PemabuService | undefined {
  return services.find((s) => s.service_key === key);
}

function priceLabel(s: PemabuService): string {
  if (s.pricing_model === "one_time") return `$${s.price_usd} one-time`;
  if (s.pricing_model === "annual") return `$${s.price_usd} / year`;
  if (s.pricing_model === "per_event") return `$${s.price_usd} each`;
  return `$${s.price_usd}`;
}

export default async function PricingPage() {
  const services = await getPricingData();

  const core = services.filter((s) => s.category === "core");
  const subscriptions = services.filter((s) => s.category === "subscription");
  const addons = services.filter((s) => s.category === "addon");
  const upgrades = services.filter((s) => s.category === "upgrade");
  const overages = services.filter((s) => s.category === "overage");

  const coreV1 = pick(services, "core_v1");
  const intel = pick(services, "intelligence_annual");
  const liveBroadcast = pick(services, "live_broadcast_addon");
  const v1v2 = pick(services, "v1_to_v2_upgrade");
  const simOver = pick(services, "scenario_sim_overage");

  const y1CorePlusLive =
    coreV1 && liveBroadcast ? Math.round(coreV1.price_usd + liveBroadcast.price_usd) : null;

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

      {coreV1 && liveBroadcast && intel ? (
        <div className="mx-auto mb-12 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.02] p-8">
          <h2 className="mb-4 text-center text-sm font-medium uppercase tracking-wider text-gray-400">
            Why Intelligence is the anchor tier
          </h2>
          <p className="mb-6 text-center text-xs text-gray-500">
            Core v1 ({priceLabel(coreV1)}) plus the Live Broadcast add-on ({priceLabel(liveBroadcast)}) totals{" "}
            {y1CorePlusLive != null ? `$${y1CorePlusLive}` : ""} in year one. Pemabu Intelligence ({priceLabel(intel)})
            already includes Live Broadcast, Political Trade Tracker, multi-account support, real-time feeds, and far
            more — so upgrading from Core is the rational default once you need live viewing.
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
                <td className="py-3 text-right font-mono text-white">
                  ${coreV1.price_usd} + ${liveBroadcast.price_usd}/yr
                  {y1CorePlusLive != null ? ` → $${y1CorePlusLive} Y1` : ""}
                </td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3">Pemabu Intelligence (annual)</td>
                <td className="py-3 text-right font-mono text-emerald-300">
                  ${intel.price_usd}/yr (includes Live Broadcast)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl space-y-10 text-left text-sm text-gray-300">
        {core.map((s) => (
          <section key={s.service_key} className="rounded-2xl border border-white/10 p-8">
            <h2 className="mb-2 text-lg font-medium text-white">{s.display_name}</h2>
            <p className="mb-4 font-mono text-emerald-300">{priceLabel(s)}</p>
            <p className="leading-relaxed text-gray-400">{s.description}</p>
          </section>
        ))}

        {subscriptions.map((s) => (
          <section key={s.service_key} className="rounded-2xl border border-white/10 p-8">
            <h2 className="mb-2 text-lg font-medium text-white">{s.display_name}</h2>
            <p className="mb-4 font-mono text-emerald-300">{priceLabel(s)}</p>
            <p className="leading-relaxed text-gray-400">{s.description}</p>
            {s.service_key === "intelligence_annual" ? (
              <p className="mt-4 leading-relaxed text-gray-400">
                <strong className="font-medium text-gray-300">20 simulations/month included.</strong> Additional
                simulations beyond the soft cap are billed at{" "}
                {simOver ? (
                  <strong className="font-medium text-gray-300">${simOver.price_usd} each.</strong>
                ) : (
                  <span>the Scenario Simulation overage rate in the Additional section.</span>
                )}
              </p>
            ) : null}
            {s.service_key === "autonomous_annual" && intel ? (
              <p className="mt-4 leading-relaxed text-gray-400">
                <strong className="font-medium text-gray-300">Unlimited scenario simulations included.</strong> The $
                {Math.round(s.price_usd - intel.price_usd)} delta vs Intelligence covers execution, compliance-grade
                logging, and automation depth. The immutable audit ledger is a tax and compliance feature: a complete
                append-only transaction ledger for your accountant or tax preparer, with pre-sorted realized gains and
                losses by tax lot.
              </p>
            ) : null}
          </section>
        ))}

        {addons.length > 0 ? (
          <section className="rounded-2xl border border-white/10 p-8">
            <h2 className="mb-6 text-lg font-medium text-white">Add-on bundles</h2>
            <div className="space-y-4">
              {ADDON_BUNDLES.map((bundle) => {
                const items = bundle.keys
                  .map((k) => pick(services, k))
                  .filter((x): x is PemabuService => !!x);
                const total = items.reduce((sum, x) => sum + x.price_usd, 0);
                return (
                  <details
                    key={bundle.name}
                    className="group rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4"
                  >
                    <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-base font-medium text-white">{bundle.name}</p>
                          <p className="text-xs text-gray-500">{bundle.description}</p>
                        </div>
                        <p className="mt-2 font-mono text-emerald-300 sm:mt-0">
                          ${total.toFixed(0)}/yr if all purchased
                        </p>
                      </div>
                      <p className="mt-2 text-[11px] text-gray-600">Expand for individual list prices.</p>
                    </summary>
                    <ul className="mt-4 space-y-2 border-t border-white/5 pt-4 font-mono text-xs text-gray-400">
                      {items.map((a) => (
                        <li key={a.service_key} className="flex justify-between gap-4">
                          <span>{a.display_name}</span>
                          <span className="text-white">{priceLabel(a)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })}
            </div>
          </section>
        ) : null}

        {(upgrades.length > 0 || overages.length > 0) && (
          <section className="rounded-2xl border border-white/10 p-8">
            <h2 className="mb-2 text-lg font-medium text-white">Additional</h2>
            <p className="mb-4 text-xs text-gray-500">
              Version upgrades and metered usage — shown separately from add-on bundles.
            </p>
            <ul className="space-y-3 text-xs text-gray-400">
              {v1v2 ? (
                <li>
                  <span className="font-mono text-gray-300">{v1v2.display_name}</span> — {priceLabel(v1v2)}
                  {v1v2.description ? <span className="block pt-1 text-gray-500">{v1v2.description}</span> : null}
                </li>
              ) : null}
              {simOver ? (
                <li>
                  <span className="font-mono text-gray-300">{simOver.display_name}</span> — {priceLabel(simOver)}
                  {simOver.description ? <span className="block pt-1 text-gray-500">{simOver.description}</span> : null}
                </li>
              ) : null}
              {overages
                .filter((o) => o.service_key !== "scenario_sim_overage")
                .map((o) => (
                  <li key={o.service_key}>
                    <span className="font-mono text-gray-300">{o.display_name}</span> — {priceLabel(o)}
                    {o.description ? <span className="block pt-1 text-gray-500">{o.description}</span> : null}
                  </li>
                ))}
            </ul>
          </section>
        )}

        <p className="mt-4 text-center text-xs text-gray-500">
          Pemabu is not a registered investment advisor. All platform outputs are for informational purposes only and
          do not constitute financial advice.
        </p>

        <p className="text-center text-xs text-gray-600">
          Spots are limited. Beta access is by invitation only. Prices reflect the live service catalog; active
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
