import Link from "next/link";
import type { PemabuService, PricingModel, ServiceCategory } from "@/lib/types/database";
import { INTELLIGENCE_FEATURES } from "@/lib/constants/intelligence-features";
import { PEMABU_SERVICES } from "@/lib/constants/services";
import { getCachedServices } from "@/lib/cache/service-catalog";
import { intelligenceFeatureHref, serviceHref } from "@/lib/dashboard/service-links";

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

function staticRow(row: (typeof PEMABU_SERVICES)[number], i: number): PemabuService {
  return {
    id: `catalog-fallback-${row.service_key}`,
    service_key: row.service_key,
    display_name: row.display_name,
    description: row.description,
    category: row.category as ServiceCategory,
    pricing_model: row.pricing_model as PricingModel,
    price_usd: row.price_usd,
    is_active: true,
    sort_order: i,
    created_at: "",
    updated_at: "",
  };
}

/** Overlay API rows onto canonical `PEMABU_SERVICES` order; fill empty DB copy; fill missing keys from static defaults. */
function fullCatalogWithPrices(api: PemabuService[]): PemabuService[] {
  const byKey = new Map(api.map((s) => [s.service_key, s]));
  return PEMABU_SERVICES.map((row, i) => {
    const live = byKey.get(row.service_key);
    if (live) {
      return {
        ...live,
        display_name: live.display_name?.trim() || row.display_name,
        description: live.description?.trim() || row.description,
      };
    }
    return staticRow(row, i);
  });
}

function marketingDescription(s: PemabuService): string {
  return s.description?.trim() || "";
}

const WHATS_INCLUDED = [
  "Pemabu Core v1 engine access",
  "Pemabu Intelligence & Autonomous feature set",
  "Live Broadcast, Political Trade Tracker, and 13F Institutional Overlay (included in paid Intelligence — bundled in beta)",
  "Scenario simulations (Autonomous = unlimited in GA)",
  "Admin dashboard & workbook tooling",
] as const;

const INTELLIGENCE_INCLUDED_LINKS = [
  {
    label: "Political Trade Tracker",
    href: serviceHref("addon_political_tracker"),
    note: "Included with Intelligence; $29/yr add-on for Core-only users",
  },
  {
    label: "13F Institutional Overlay",
    href: intelligenceFeatureHref("intelligence_13f_overlay"),
    note: "Included with Intelligence and Autonomous",
  },
  {
    label: "Live Broadcast",
    href: serviceHref("live_broadcast_addon"),
    note: "Included with Intelligence; $79/yr add-on for Core-only users",
  },
] as const;

export default async function PricingPage() {
  const apiRows = await getPricingData();
  const merged = fullCatalogWithPrices(apiRows);
  const services = merged.filter((s) => s.is_active);

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

      <section className="mx-auto mb-16 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.02] p-8">
        <h2 className="mb-4 text-center text-sm font-medium uppercase tracking-wider text-gray-400">
          What Pemabu includes
        </h2>
        <p className="mb-6 text-center text-xs text-gray-500">
          Core engine, Intelligence and Autonomous capabilities, live viewing and policy overlays, simulations by tier,
          and operator tooling — as described in each catalog item below.
        </p>
        <ul className="mx-auto max-w-xl space-y-3 text-left text-sm text-gray-300">
          {WHATS_INCLUDED.map((line) => (
            <li key={line} className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mx-auto mb-16 max-w-2xl rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-10 text-center">
        <p className="mb-4 text-xs uppercase tracking-widest text-emerald-400">Private beta</p>
        <p className="mb-2 text-5xl font-light text-white">Complimentary</p>
        <p className="mb-8 text-sm text-gray-500">All active catalog services · no expiry while beta is active</p>
        <ul className="mx-auto mb-8 max-w-xs space-y-3 text-left">
          {WHATS_INCLUDED.map((feature) => (
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
            already includes Live Broadcast, Political Trade Tracker, 13F institutional overlay, multi-account support,
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
            <p className="leading-relaxed text-gray-400">{marketingDescription(s)}</p>
          </section>
        ))}

        {subscriptions.map((s) => (
          <section key={s.service_key} className="rounded-2xl border border-white/10 p-8">
            <h2 className="mb-2 text-lg font-medium text-white">{s.display_name}</h2>
            <p className="mb-4 font-mono text-emerald-300">{priceLabel(s)}</p>
            <p className="leading-relaxed text-gray-400">{marketingDescription(s)}</p>
            {s.service_key === "intelligence_annual" ? (
              <>
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    Included apps (sign in to open)
                  </p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {INTELLIGENCE_INCLUDED_LINKS.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} className="font-medium text-emerald-400 hover:text-emerald-300">
                          {item.label}
                        </Link>
                        <span className="text-gray-500"> — {item.note}</span>
                      </li>
                    ))}
                    {INTELLIGENCE_FEATURES.filter(
                      (f) => !INTELLIGENCE_INCLUDED_LINKS.some((l) => l.href === f.route),
                    ).map((f) => (
                      <li key={f.feature_key}>
                        <Link
                          href={f.route}
                          className="font-medium text-emerald-400 hover:text-emerald-300"
                        >
                          {f.display_name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-4 leading-relaxed text-gray-400">
                  <strong className="font-medium text-gray-300">20 simulations/month included.</strong> Additional
                  simulations beyond the soft cap are billed at{" "}
                  {simOver ? (
                    <strong className="font-medium text-gray-300">${simOver.price_usd} each.</strong>
                  ) : (
                    <span>the Scenario Simulation overage rate in the Additional section.</span>
                  )}
                </p>
              </>
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
                    <ul className="mt-4 space-y-4 border-t border-white/5 pt-4 text-xs text-gray-400">
                      {items.map((a) => (
                        <li key={a.service_key} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
                          <div className="flex justify-between gap-4 font-mono">
                            <Link
                              href={serviceHref(a.service_key)}
                              className="text-gray-300 transition-colors hover:text-emerald-300"
                            >
                              {a.display_name}
                            </Link>
                            <span className="text-white">{priceLabel(a)}</span>
                          </div>
                          {marketingDescription(a) ? (
                            <p className="mt-2 pl-0 font-sans text-[11px] leading-relaxed text-gray-500">
                              {marketingDescription(a)}
                            </p>
                          ) : null}
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
                  {marketingDescription(v1v2) ? (
                    <span className="block pt-1 text-gray-500">{marketingDescription(v1v2)}</span>
                  ) : null}
                </li>
              ) : null}
              {simOver ? (
                <li>
                  <span className="font-mono text-gray-300">{simOver.display_name}</span> — {priceLabel(simOver)}
                  {marketingDescription(simOver) ? (
                    <span className="block pt-1 text-gray-500">{marketingDescription(simOver)}</span>
                  ) : null}
                </li>
              ) : null}
              {overages
                .filter((o) => o.service_key !== "scenario_sim_overage")
                .map((o) => (
                  <li key={o.service_key}>
                    <span className="font-mono text-gray-300">{o.display_name}</span> — {priceLabel(o)}
                    {marketingDescription(o) ? (
                      <span className="block pt-1 text-gray-500">{marketingDescription(o)}</span>
                    ) : null}
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
