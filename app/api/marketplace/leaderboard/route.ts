import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPublicSupabaseClient } from "@/lib/supabase/public-server";
import { isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { resolveEffectiveTier, tierMeetsMinimum } from "@/lib/security/tier-guard";
import {
  listMarketplaceLeaderboardSupabase,
  listMarketplaceLeaderboardTeaserSupabase,
  listMarketplaceLeaderboardTeaserVault,
  listMarketplaceLeaderboardVault,
  type LeaderboardRow,
} from "@/lib/marketplace/vault-marketplace";
import { strategyPeerPseudonym } from "@/lib/marketplace/peer-pseudonym";

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("limit");
  const n = raw ? Number(raw) : 25;
  const limit = Number.isFinite(n) ? Math.min(100, Math.max(1, Math.floor(n))) : 25;

  let viewerIntelligence = false;
  let authenticated = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authenticated = !!user;
    if (user) {
      const keys = await getActiveServiceKeysForUser(user.id);
      viewerIntelligence = tierMeetsMinimum(resolveEffectiveTier(keys), "INTELLIGENCE");
    }
  } catch {
    viewerIntelligence = false;
    authenticated = false;
  }

  try {
    if (isLocalVaultExecutionPlane()) {
      if (viewerIntelligence) {
        const rows = await listMarketplaceLeaderboardVault(limit);
        const strategies = rows.map((r) => ({
          ...r,
          publisher_pseudonym: strategyPeerPseudonym(r.id),
        }));
        return NextResponse.json({ strategies, viewer: { isIntelligence: true, authenticated } });
      }
      const strategies = await listMarketplaceLeaderboardTeaserVault(limit);
      return NextResponse.json({
        strategies,
        viewer: { isIntelligence: false, authenticated },
      });
    }

    if (viewerIntelligence) {
      const supabase = await createClient();
      const rows = await listMarketplaceLeaderboardSupabase(supabase, limit);
      const strategies = rows.map((r: LeaderboardRow) => ({
        ...r,
        publisher_pseudonym: strategyPeerPseudonym(r.id),
      }));
      return NextResponse.json({ strategies, viewer: { isIntelligence: true, authenticated } });
    }

    const pub = createPublicSupabaseClient();
    const strategies = await listMarketplaceLeaderboardTeaserSupabase(pub, limit);
    return NextResponse.json({
      strategies,
      viewer: { isIntelligence: false, authenticated },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
