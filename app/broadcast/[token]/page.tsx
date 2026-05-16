import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BroadcastViewerClient } from "@/components/broadcast/BroadcastViewerClient";
import { hashBroadcastToken } from "@/lib/broadcast/token-service";

// Public viewer page — no auth required.
// The session must have is_live=true and a valid (non-expired) token.
export default async function BroadcastViewerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = hashBroadcastToken(token);

  // Use anon client — this page is intentionally public.
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("broadcast_sessions")
    .select("id, is_live, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!session) notFound();

  const isExpired = new Date(session.expires_at as string) < new Date();
  const isLive = session.is_live as boolean;

  const relayUrl = process.env.FLOMISMA_RELAY_URL ?? "";
  const relayKey = process.env.FLOMISMA_RELAY_KEY ?? "";

  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8 sm:px-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">Pemabu Live Broadcast</h1>
          <div className="flex items-center gap-2">
            {isLive && !isExpired ? (
              <>
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-400 font-medium">LIVE</span>
              </>
            ) : (
              <span className="text-xs text-gray-500">
                {isExpired ? "Expired" : "Offline"}
              </span>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Read-only signal feed. No portfolio data, tickers, or balances are transmitted.
        </p>

        {isExpired ? (
          <div className="text-center py-16 text-gray-600">
            <p className="text-lg">Session expired</p>
            <p className="text-sm mt-1">The broadcaster will need to create a new session.</p>
          </div>
        ) : !isLive ? (
          <div className="text-center py-16 text-gray-600">
            <p className="text-lg">Broadcaster is offline</p>
            <p className="text-sm mt-1">The session will go live when the broadcaster starts streaming.</p>
          </div>
        ) : relayUrl ? (
          <BroadcastViewerClient token={token} relayUrl={relayUrl} relayKey={relayKey} />
        ) : (
          <div className="text-center py-16 text-gray-500">
            <p>WebSocket relay not configured on this deployment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
