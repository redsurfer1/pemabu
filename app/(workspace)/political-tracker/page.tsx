import { requireServiceAccess } from "@/lib/security/tier-guard";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PoliticalTrackerClient } from "@/components/political-tracker/PoliticalTrackerClient";
import type { Portfolio } from "@/lib/types/database";

// Political Trade Tracker — addon_political_tracker or Intelligence/Autonomous tier.
// TIER_INCLUSIONS includes addon_political_tracker in intelligence_annual and autonomous_annual,
// so requireServiceAccess("addon_political_tracker") gates correctly for all three.
export default async function PoliticalTrackerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireServiceAccess("addon_political_tracker");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: portfolios } = await supabaseAdmin
    .from("portfolios")
    .select("id, name")
    .eq("user_id", user!.id)
    .order("created_at");

  const portfolioList = (portfolios ?? []) as Pick<Portfolio, "id" | "name">[];

  const sp = await searchParams;
  const portfolioId = sp.portfolio_id ?? portfolioList[0]?.id ?? null;

  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Political Trade Tracker</h1>
          <p className="mt-1 text-sm text-gray-400">
            Congressional stock disclosures — sourced daily from House Stock Watcher.
          </p>
        </div>

        {portfolioList.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Portfolio:</span>
            <div className="flex flex-wrap gap-2">
              {portfolioList.map((p) => (
                <a
                  key={p.id}
                  href={`/political-tracker?portfolio_id=${p.id}`}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    p.id === portfolioId
                      ? "bg-emerald-600 text-white"
                      : "bg-white/10 text-gray-300 hover:bg-white/20"
                  }`}
                >
                  {p.name}
                </a>
              ))}
            </div>
          </div>
        )}

        {portfolioId ? (
          <PoliticalTrackerClient portfolioId={portfolioId} />
        ) : (
          <p className="text-gray-500 text-sm">
            Create a portfolio first to see congressional trade signals.
          </p>
        )}
      </div>
    </div>
  );
}
