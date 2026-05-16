import { requireServiceAccess } from "@/lib/security/tier-guard";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BroadcastHostClient } from "@/components/broadcast/BroadcastHostClient";
import type { Portfolio } from "@/lib/types/database";

export default async function BroadcastPage() {
  await requireServiceAccess("live_broadcast_addon");

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

  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8 sm:px-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Broadcast</h1>
          <p className="mt-1 text-sm text-gray-400">
            Share a read-only live view of your portfolio via a secure token link.
            No credentials or holdings leave your device — only watcher signals are relayed.
          </p>
        </div>

        {portfolioList.length === 0 ? (
          <p className="text-gray-500 text-sm">Create a portfolio first to start broadcasting.</p>
        ) : (
          <BroadcastHostClient portfolios={portfolioList} />
        )}

        <div className="bg-white/5 rounded-xl p-5 space-y-2">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">How it works</h3>
          <ol className="space-y-2 text-sm text-gray-400 list-decimal list-inside">
            <li>Create a broadcast session and copy the viewer link.</li>
            <li>Share the link with family members or advisors.</li>
            <li>Click &quot;Go Live&quot; — viewers see a live-updating signal feed.</li>
            <li>Stop at any time. Sessions expire after 24 hours automatically.</li>
          </ol>
          <p className="text-xs text-gray-600 pt-1">
            The viewer link gives read-only access to watcher signals only. No tickers, NAV, or cost basis data is transmitted.
          </p>
        </div>
      </div>
    </div>
  );
}
