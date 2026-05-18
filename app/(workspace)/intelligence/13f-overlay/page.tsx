import { redirect } from "next/navigation";
import { ThirteenFOverlayClient } from "@/components/intelligence/ThirteenFOverlayClient";
import { requireIntelligenceTier } from "@/lib/portfolio/intelligence-access";
import { getEquityTickersForUser } from "@/lib/portfolio/portfolio-tickers";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { createClient } from "@/lib/supabase/server";

export default async function ThirteenFOverlayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const keys = await getActiveServiceKeysForUser(user.id);
  if (requireIntelligenceTier(keys)) {
    redirect("/upgrade?service=intelligence_annual");
  }

  const sp = await searchParams;
  const portfolioTickers = await getEquityTickersForUser(user.id);
  const initialTicker =
    sp.ticker?.toUpperCase().trim() || portfolioTickers[0] || "AAPL";

  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">13F Institutional Overlay</h1>
          <p className="mt-1 text-sm text-gray-400">
            Hedge fund 13F-HR filings from SEC EDGAR — included with Pemabu Intelligence and Autonomous.
          </p>
        </div>
        <ThirteenFOverlayClient initialTicker={initialTicker} portfolioTickers={portfolioTickers} />
      </div>
    </div>
  );
}
