import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchSnapshotProposals } from "@/lib/governance/snapshot-client";
import { summariseProposal } from "@/lib/governance/governance-summariser";
import { assertServiceAccess } from "@/lib/security/tier-guard";

const ADDON = "addon_governance_alerts";

function numScore(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export const GET = withAuth(async (_req, user) => {
  await assertServiceAccess(user.id, ADDON);

  const { data: watchList } = await supabaseAdmin
    .from("governance_watch_list")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (!watchList?.length) {
    return NextResponse.json({ alerts: [] });
  }

  const fetchResults = await Promise.allSettled(
    watchList
      .filter((w: { space_id: string | null }) => Boolean(w.space_id))
      .map(async (w: { token_ticker: string; space_id: string }) => {
        const proposals = await fetchSnapshotProposals(w.space_id, 5);
        return { ticker: w.token_ticker, proposals };
      }),
  );

  for (const result of fetchResults) {
    if (result.status !== "fulfilled") continue;
    const { ticker, proposals } = result.value;

    for (const proposal of proposals) {
      const { data: existing } = await supabaseAdmin
        .from("governance_proposals")
        .select("id, plain_english_summary")
        .eq("external_id", proposal.id)
        .eq("source", "snapshot")
        .maybeSingle();

      const summary =
        existing?.plain_english_summary?.trim() ||
        (await summariseProposal(proposal.title, proposal.body ?? "", ticker, user.id));

      const scores = proposal.scores ?? [];
      const votesFor = numScore(scores[0]);
      const votesAgainst = numScore(scores[1]);
      const votesAbstain = numScore(scores[2]);

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
          votes_for: votesFor,
          votes_against: votesAgainst,
          votes_abstain: votesAbstain,
          quorum_required: proposal.quorum != null ? Number(proposal.quorum) : null,
          url: proposal.link ?? null,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "external_id,source" },
      );
      if (upErr) {
        console.error("governance_proposals upsert:", upErr.message);
        continue;
      }

      const { data: row } = await supabaseAdmin
        .from("governance_proposals")
        .select("id")
        .eq("external_id", proposal.id)
        .eq("source", "snapshot")
        .single();

      if (row?.id) {
        const { error: alErr } = await supabaseAdmin.from("governance_user_alerts").upsert(
          {
            user_id: user.id,
            proposal_id: row.id,
            token_ticker: ticker,
          },
          { onConflict: "user_id,proposal_id" },
        );
        if (alErr) console.error("governance_user_alerts upsert:", alErr.message);
      }
    }
  }

  const { data: alertRows, error: alQ } = await supabaseAdmin
    .from("governance_user_alerts")
    .select("id, is_read, is_dismissed, alerted_at, token_ticker, proposal_id")
    .eq("user_id", user.id)
    .eq("is_dismissed", false)
    .order("alerted_at", { ascending: false })
    .limit(50);

  if (alQ) throw alQ;

  const ids = [...new Set((alertRows ?? []).map((a) => a.proposal_id).filter(Boolean))] as string[];
  let proposalMap = new Map<string, Record<string, unknown>>();
  if (ids.length) {
    const { data: props, error: pErr } = await supabaseAdmin
      .from("governance_proposals")
      .select(
        "id, token_ticker, title, plain_english_summary, state, vote_deadline, votes_for, votes_against, votes_abstain, quorum_required, url",
      )
      .in("id", ids);
    if (pErr) throw pErr;
    proposalMap = new Map((props ?? []).map((p) => [String(p.id), p as Record<string, unknown>]));
  }

  const alerts = (alertRows ?? []).map((a) => ({
    ...a,
    governance_proposals: proposalMap.get(String(a.proposal_id)),
  }));

  return NextResponse.json({ alerts });
});
