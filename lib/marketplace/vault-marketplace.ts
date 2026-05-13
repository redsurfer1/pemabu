import { getVaultPool } from "@/lib/db";
import { isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LeaderboardRow = {
  id: string;
  display_name: string;
  strategy_grade: string;
  blueprint_adherence_score: string;
  vw_rsi_performance_score: string;
  published_at: string;
};

/** Public teaser: no adherence column (privacy / product positioning). */
export type PublicLeaderboardTeaserRow = {
  display_name: string;
  strategy_grade: string;
  vw_rsi_performance_score: string;
};

export async function listMarketplaceLeaderboardTeaserSupabase(
  supabase: SupabaseClient,
  limit: number,
): Promise<PublicLeaderboardTeaserRow[]> {
  const { data, error } = await supabase
    .from("marketplace_leaderboard_public")
    .select("display_name, strategy_grade, vw_rsi_performance_score")
    .order("strategy_grade", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    display_name: String((r as { display_name: string }).display_name),
    strategy_grade: String((r as { strategy_grade: number }).strategy_grade),
    vw_rsi_performance_score: String((r as { vw_rsi_performance_score: number }).vw_rsi_performance_score),
  }));
}

export async function listMarketplaceLeaderboardTeaserVault(limit: number): Promise<PublicLeaderboardTeaserRow[]> {
  const { rows } = await getVaultPool().query<{
    display_name: string;
    strategy_grade: string;
    vw_rsi_performance_score: string;
  }>(
    `SELECT display_name, strategy_grade::text, vw_rsi_performance_score::text
     FROM marketplace_leaderboard_public
     ORDER BY strategy_grade DESC, published_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function listMarketplaceLeaderboardSupabase(supabase: SupabaseClient, limit: number): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from("marketplace_leaderboard_public")
    .select("id, display_name, strategy_grade, blueprint_adherence_score, vw_rsi_performance_score, published_at")
    .order("strategy_grade", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    display_name: String((r as { display_name: string }).display_name),
    strategy_grade: String((r as { strategy_grade: number }).strategy_grade),
    blueprint_adherence_score: String((r as { blueprint_adherence_score: number }).blueprint_adherence_score),
    vw_rsi_performance_score: String((r as { vw_rsi_performance_score: number }).vw_rsi_performance_score),
    published_at: String((r as { published_at: string }).published_at),
  }));
}

export async function listMarketplaceLeaderboardVault(limit: number): Promise<LeaderboardRow[]> {
  const { rows } = await getVaultPool().query<{
    id: string;
    display_name: string;
    strategy_grade: string;
    blueprint_adherence_score: string;
    vw_rsi_performance_score: string;
    published_at: string;
  }>(
    `SELECT id::text, display_name, strategy_grade::text, blueprint_adherence_score::text,
            vw_rsi_performance_score::text, published_at::text
     FROM marketplace_leaderboard_public
     ORDER BY strategy_grade DESC, published_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function insertMarketplaceStrategy(
  supabase: SupabaseClient | null,
  row: {
    publisher_user_id: string;
    sleeve_token_hash: string;
    display_name: string;
    blueprint: unknown;
    strategy_grade: string;
    blueprint_adherence_score: string;
    vw_rsi_performance_score: string;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  if (isLocalVaultExecutionPlane()) {
    await getVaultPool().query(
      `INSERT INTO marketplace_strategies (
         publisher_user_id, sleeve_token_hash, display_name, blueprint_json, strategy_grade,
         blueprint_adherence_score, vw_rsi_performance_score, metadata
       ) VALUES ($1::uuid, $2, $3, $4::jsonb, $5::numeric, $6::numeric, $7::numeric, $8::jsonb)
       ON CONFLICT (sleeve_token_hash) DO UPDATE SET
         publisher_user_id = EXCLUDED.publisher_user_id,
         display_name = EXCLUDED.display_name,
         blueprint_json = EXCLUDED.blueprint_json,
         strategy_grade = EXCLUDED.strategy_grade,
         blueprint_adherence_score = EXCLUDED.blueprint_adherence_score,
         vw_rsi_performance_score = EXCLUDED.vw_rsi_performance_score,
         metadata = EXCLUDED.metadata,
         published_at = now()`,
      [
        row.publisher_user_id,
        row.sleeve_token_hash,
        row.display_name,
        JSON.stringify(row.blueprint),
        row.strategy_grade,
        row.blueprint_adherence_score,
        row.vw_rsi_performance_score,
        JSON.stringify(row.metadata),
      ],
    );
    return;
  }
  if (!supabase) throw new Error("Supabase client required");
  const { error } = await supabase.from("marketplace_strategies").upsert(
    {
      publisher_user_id: row.publisher_user_id,
      sleeve_token_hash: row.sleeve_token_hash,
      display_name: row.display_name,
      blueprint_json: row.blueprint,
      strategy_grade: Number(row.strategy_grade),
      blueprint_adherence_score: Number(row.blueprint_adherence_score),
      vw_rsi_performance_score: Number(row.vw_rsi_performance_score),
      metadata: row.metadata,
    },
    { onConflict: "sleeve_token_hash" },
  );
  if (error) throw new Error(error.message);
}
