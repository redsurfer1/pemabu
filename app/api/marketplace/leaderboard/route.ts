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
import { publicCreatorId } from "@/lib/marketplace/public-creator-id";

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("limit");
  const n = raw ? Number(raw) : 25;
  const limit = Number.isFinite(n) ? Math.min(100, Math.max(1, Math.floor(n))) : 25;

  let viewerIntelligence = false;
  let authenticated = false;
  let viewerUserId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authenticated = !!user;
    viewerUserId = user?.id ?? null;
    if (user) {
      const keys = await getActiveServiceKeysForUser(user.id);
      viewerIntelligence = tierMeetsMinimum(resolveEffectiveTier(keys), "INTELLIGENCE");
    }
  } catch {
    viewerIntelligence = false;
    authenticated = false;
    viewerUserId = null;
  }

  try {
    if (isLocalVaultExecutionPlane()) {
      if (viewerIntelligence) {
        const rows = await listMarketplaceLeaderboardVault(limit);
        const strategies = rows.map((r) => ({
          id: r.id,
          display_name: r.display_name,
          strategy_grade: r.strategy_grade,
          blueprint_adherence_score: r.blueprint_adherence_score,
          vw_rsi_performance_score: r.vw_rsi_performance_score,
          published_at: r.published_at,
          is_founding_publisher: r.is_founding_publisher ?? false,
          creator_public_id: r.publisher_user_id ? publicCreatorId(r.publisher_user_id) : null,
          is_own_publisher: !!viewerUserId && r.publisher_user_id === viewerUserId,
          performance_consistency: r.performance_consistency ?? "new",
          performance_avg_drift_pct: r.performance_avg_drift_pct ?? null,
          performance_weeks_tracked: r.performance_weeks_tracked ?? 0,
          publisher_pseudonym: strategyPeerPseudonym(r.id),
        }));
        return NextResponse.json({
          strategies,
          viewer: {
            isIntelligence: true,
            authenticated,
            userId: viewerUserId,
            creatorPublicId: viewerUserId ? publicCreatorId(viewerUserId) : null,
          },
        });
      }
      const strategies = await listMarketplaceLeaderboardTeaserVault(limit);
      return NextResponse.json({
        strategies,
        viewer: {
          isIntelligence: false,
          authenticated,
          userId: viewerUserId,
          creatorPublicId: viewerUserId ? publicCreatorId(viewerUserId) : null,
        },
      });
    }

    if (viewerIntelligence) {
      const supabase = await createClient();
      const rows = await listMarketplaceLeaderboardSupabase(supabase, limit);
      const strategies = rows.map((r: LeaderboardRow) => ({
        id: r.id,
        display_name: r.display_name,
        strategy_grade: r.strategy_grade,
        blueprint_adherence_score: r.blueprint_adherence_score,
        vw_rsi_performance_score: r.vw_rsi_performance_score,
        published_at: r.published_at,
        is_founding_publisher: r.is_founding_publisher ?? false,
        creator_public_id: r.publisher_user_id ? publicCreatorId(r.publisher_user_id) : null,
        is_own_publisher: !!viewerUserId && r.publisher_user_id === viewerUserId,
        performance_consistency: r.performance_consistency ?? "new",
        performance_avg_drift_pct: r.performance_avg_drift_pct ?? null,
        performance_weeks_tracked: r.performance_weeks_tracked ?? 0,
        publisher_pseudonym: strategyPeerPseudonym(r.id),
      }));
      return NextResponse.json({
        strategies,
        viewer: {
          isIntelligence: true,
          authenticated,
          userId: viewerUserId,
          creatorPublicId: viewerUserId ? publicCreatorId(viewerUserId) : null,
        },
      });
    }

    const pub = createPublicSupabaseClient();
    const strategies = await listMarketplaceLeaderboardTeaserSupabase(pub, limit);
    return NextResponse.json({
      strategies,
      viewer: {
        isIntelligence: false,
        authenticated,
        userId: viewerUserId,
        creatorPublicId: viewerUserId ? publicCreatorId(viewerUserId) : null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
