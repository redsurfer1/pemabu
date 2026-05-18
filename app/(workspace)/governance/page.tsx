import { KNOWN_SNAPSHOT_SPACES } from "@/lib/governance/snapshot-client";
import { getPortfolioTickersForUser } from "@/lib/portfolio/portfolio-tickers";
import { requireServiceAccess } from "@/lib/security/tier-guard";
import { createClient } from "@/lib/supabase/server";
import { GovernanceClient } from "@/components/governance/GovernanceClient";

export default async function GovernancePage() {
  await requireServiceAccess("addon_governance_alerts");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const holdings = user ? await getPortfolioTickersForUser(user.id) : [];
  const portfolioTickers = holdings.filter((t) => t in KNOWN_SNAPSHOT_SPACES);

  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8 sm:px-8">
      <GovernanceClient portfolioTickers={portfolioTickers} />
    </div>
  );
}
