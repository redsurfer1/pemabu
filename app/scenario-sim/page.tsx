import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { resolveEffectiveTier } from "@/lib/security/tier-guard";
import { ScenarioSimClient } from "@/components/scenario-sim/ScenarioSimClient";
import type { Portfolio } from "@/lib/types/database";

export default async function ScenarioSimPage({
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
  const tier = resolveEffectiveTier(keys);

  if (tier === "CORE") {
    redirect("/upgrade?service=intelligence_annual");
  }

  const { data: portfolios } = await supabaseAdmin
    .from("portfolios")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at");

  const portfolioList = (portfolios ?? []) as Pick<Portfolio, "id" | "name">[];
  const sp = await searchParams;
  const portfolioId = sp.portfolio_id ?? portfolioList[0]?.id ?? null;

  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8 sm:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Scenario Simulation</h1>
          <p className="mt-1 text-sm text-gray-400">
            Model allocation changes before applying them. Intelligence: 20 runs/month included. Autonomous: unlimited.
          </p>
        </div>

        {portfolioList.length > 1 && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-400">Portfolio:</span>
            {portfolioList.map((p) => (
              <a
                key={p.id}
                href={`/scenario-sim?portfolio_id=${p.id}`}
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
        )}

        {portfolioId ? (
          <ScenarioSimClient portfolioId={portfolioId} />
        ) : (
          <p className="text-gray-500 text-sm">Create a portfolio first to run simulations.</p>
        )}
      </div>
    </div>
  );
}
