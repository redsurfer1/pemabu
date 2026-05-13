/**
 * Ephemeral relay signals — never include tickers, NAV, or PII.
 */
async function pingFlomismaRelay(type: "WATCHER_UPDATE" | "TRADE_PENDING"): Promise<void> {
  const url = process.env.FLOMISMA_RELAY_URL;
  const key = process.env.FLOMISMA_RELAY_KEY;
  if (!url || !key) return;
  const body = JSON.stringify({
    type,
    timestamp: new Date().toISOString(),
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body,
  });
  if (!res.ok) {
    console.warn(`[flomisma] ${type} relay non-OK`, res.status);
  }
}

export async function pingFlomismaTradePending(): Promise<void> {
  await pingFlomismaRelay("TRADE_PENDING");
}

export async function pingFlomismaWatcherUpdate(): Promise<void> {
  await pingFlomismaRelay("WATCHER_UPDATE");
}
