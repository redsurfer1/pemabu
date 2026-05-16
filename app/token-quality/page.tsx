import { requireServiceAccess } from "@/lib/security/tier-guard";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TokenQualityClient } from "@/components/token-quality/TokenQualityClient";

export default async function TokenQualityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireServiceAccess("addon_token_quality");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pull crypto holdings tickers from all portfolios for quick-access buttons.
  const { data: portfolios } = await supabaseAdmin
    .from("portfolios")
    .select("id")
    .eq("user_id", user!.id);

  const portfolioIds = ((portfolios ?? []) as Array<{ id: string }>).map((p) => p.id);

  let cryptoTickers: string[] = [];
  if (portfolioIds.length > 0) {
    const { data: holdings } = await supabaseAdmin
      .from("holdings")
      .select("ticker")
      .in("portfolio_id", portfolioIds)
      .eq("asset_class", "crypto");
    cryptoTickers = [...new Set(((holdings ?? []) as Array<{ ticker: string }>).map((h) => h.ticker))];
  }

  const sp = await searchParams;
  const initialTicker = sp.ticker ? [sp.ticker.toUpperCase()] : cryptoTickers;

  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8 sm:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Token Quality Score</h1>
          <p className="mt-1 text-sm text-gray-400">
            Token Transparency Framework (TTF) — 18 criteria scored 0–100 using public on-chain and off-chain data.
          </p>
        </div>
        <TokenQualityClient initialTickers={initialTicker} />
      </div>
    </div>
  );
}
