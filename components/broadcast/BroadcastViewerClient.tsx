"use client";

import { useEffect, useRef, useState } from "react";

interface SignalPayload {
  type: string;
  timestamp: string;
}

interface BroadcastViewerClientProps {
  token: string;
  relayUrl: string;
  relayKey: string;
}

export function BroadcastViewerClient({ token, relayUrl, relayKey }: BroadcastViewerClientProps) {
  const [signals, setSignals] = useState<SignalPayload[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Use the flomisma relay URL, converting http(s) to ws(s).
    const wsUrl = relayUrl.replace(/^http/, "ws") + `?token=${encodeURIComponent(token)}&key=${encodeURIComponent(relayKey)}`;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
      };

      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data as string) as SignalPayload;
          setSignals((prev) => [payload, ...prev].slice(0, 50));
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => {
        setConnected(false);
        setError("Connection interrupted.");
      };

      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 5 seconds.
        retryRef.current = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      wsRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [token, relayUrl, relayKey]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-gray-600"}`} />
        <span className="text-xs text-gray-400">{connected ? "Live" : "Connecting…"}</span>
      </div>

      {error && !connected && (
        <p className="text-xs text-red-400">{error} Retrying…</p>
      )}

      {signals.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <p>Waiting for watcher signals…</p>
          <p className="text-xs mt-1">Signals appear here when the watcher runs or a trade is pending.</p>
        </div>
      )}

      <div className="space-y-2">
        {signals.map((s, i) => (
          <div key={i} className="flex items-start gap-3 bg-white/5 rounded-lg px-4 py-3">
            <span className="text-xs text-gray-500 mt-0.5 tabular-nums w-20 flex-shrink-0">
              {new Date(s.timestamp).toLocaleTimeString()}
            </span>
            <span className={`text-sm font-medium ${s.type === "TRADE_PENDING" ? "text-amber-300" : "text-emerald-300"}`}>
              {s.type === "TRADE_PENDING" ? "Trade Pending" : "Watcher Update"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
