import { requireServiceAccess } from "@/lib/security/tier-guard";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isDemoRequest } from "@/lib/demo/demo-guard";
import { PoliticalTrackerClient } from "@/components/political-tracker/PoliticalTrackerClient";
import type { Portfolio } from "@/lib/types/database";

export default async function PoliticalTrackerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const demo = isDemoRequest(sp);
  if (!demo) await requireServiceAccess("addon_political_tracker");

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
          <PoliticalTrackerClient portfolioId={portfolioId} demo={demo} />
        ) : (
          <p className="text-gray-500 text-sm">
            Create a portfolio first to see congressional trade signals.
          </p>
        )}
      </div>
    </div>
  );
}
