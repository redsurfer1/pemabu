// Watcher: daily governance fetch for unique Snapshot spaces.

import { supabaseAdmin } from "../../lib/supabase/admin";
import { fetchSnapshotProposals } from "../../lib/governance/snapshot-client";
import { summariseProposal } from "../../lib/governance/governance-summariser";

function numScore(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function runDailyGovernanceFetch(): Promise<void> {
  console.log("[watcher] daily governance proposal fetch…");

  const { data: watchEntries, error } = await supabaseAdmin
    .from("governance_watch_list")
    .select("user_id, token_ticker, space_id")
    .eq("is_active", true)
    .not("space_id", "is", null);

  if (error) {
    console.error("[watcher] governance watch list:", error.message);
    return;
  }

  if (!watchEntries?.length) {
    console.log("[watcher] no governance watch entries — skipping.");
    return;
  }

  const uniqueSpaces = new Map<string, string>();
  for (const entry of watchEntries as { space_id: string; token_ticker: string }[]) {
    if (entry.space_id && !uniqueSpaces.has(entry.space_id)) {
      uniqueSpaces.set(entry.space_id, entry.token_ticker);
    }
  }

  for (const [spaceId, ticker] of uniqueSpaces) {
    try {
      const proposals = await fetchSnapshotProposals(spaceId, 10);

      for (const proposal of proposals) {
        const { data: existing } = await supabaseAdmin
          .from("governance_proposals")
          .select("id, plain_english_summary")
          .eq("external_id", proposal.id)
          .eq("source", "snapshot")
          .maybeSingle();

        const summary =
          existing?.plain_english_summary?.trim() ||
          (await summariseProposal(proposal.title, proposal.body ?? "", ticker));

        const scores = proposal.scores ?? [];

        const { error: upErr } = await supabaseAdmin.from("governance_proposals").upsert(
          {
            token_ticker: ticker,
            external_id: proposal.id,
            source: "snapshot",
            title: proposal.title,
            body_preview: (proposal.body ?? "").slice(0, 500),
            plain_english_summary: summary,
            state: String(proposal.state),
            vote_deadline:
              proposal.end != null && Number.isFinite(proposal.end)
                ? new Date(Number(proposal.end) * 1000).toISOString()
                : null,
            votes_for: numScore(scores[0]),
            votes_against: numScore(scores[1]),
            votes_abstain: numScore(scores[2]),
            quorum_required: proposal.quorum != null ? Number(proposal.quorum) : null,
            url: proposal.link ?? null,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "external_id,source" },
        );
        if (upErr) {
          console.error("[watcher] governance_proposals upsert:", upErr.message);
          continue;
        }

        const { data: row } = await supabaseAdmin
          .from("governance_proposals")
          .select("id")
          .eq("external_id", proposal.id)
          .eq("source", "snapshot")
          .single();

        if (!row?.id) continue;

        const watchers = (watchEntries as { user_id: string; space_id: string; token_ticker: string }[]).filter(
          (e) => e.space_id === spaceId,
        );
        for (const watcher of watchers) {
          const { error: alErr } = await supabaseAdmin.from("governance_user_alerts").upsert(
            {
              user_id: watcher.user_id,
              proposal_id: row.id,
              token_ticker: watcher.token_ticker,
            },
            { onConflict: "user_id,proposal_id" },
          );
          if (alErr) console.error("[watcher] governance_user_alerts:", alErr.message);
        }
      }

      console.log(`[watcher] governance: ${proposals.length} proposal(s) for ${ticker} (${spaceId})`);
    } catch (err) {
      console.error(`[watcher] governance fetch failed for ${spaceId}:`, err);
    }
  }

  console.log("[watcher] governance fetch complete.");
}
