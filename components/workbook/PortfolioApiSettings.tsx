"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PORTFOLIO_API_PROVIDER_LABELS,
  PORTFOLIO_API_PROVIDERS,
  providerRequiresSecret,
  type PortfolioApiCredentialSummary,
  type PortfolioApiProvider,
} from "@/lib/portfolio/api-credentials-shared";

async function fetchCredentials(portfolioId: string): Promise<PortfolioApiCredentialSummary[]> {
  const res = await fetch(`/api/portfolio/${encodeURIComponent(portfolioId)}/api-credentials`, {
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { credentials: PortfolioApiCredentialSummary[] };
  return data.credentials ?? [];
}

export function PortfolioApiSettings({ portfolioId }: { portfolioId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<PortfolioApiProvider>("tiingo");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["portfolio-api-credentials", portfolioId],
    queryFn: () => fetchCredentials(portfolioId),
    enabled: Boolean(portfolioId),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/portfolio/${encodeURIComponent(portfolioId)}/api-credentials`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          ...(providerRequiresSecret(provider) ? { apiSecret: apiSecret.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof j.error === "string" ? j.error : "Save failed");
      }
      return res.json();
    },
    onSuccess: async () => {
      setMessage("Saved. Keys are encrypted at rest and never shown again in full.");
      setApiKey("");
      setApiSecret("");
      await qc.invalidateQueries({ queryKey: ["portfolio-api-credentials", portfolioId] });
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (p: PortfolioApiProvider) => {
      const res = await fetch(
        `/api/portfolio/${encodeURIComponent(portfolioId)}/api-credentials?provider=${encodeURIComponent(p)}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      if (!res.ok) throw new Error("Remove failed");
    },
    onSuccess: async () => {
      setMessage("Removed.");
      await qc.invalidateQueries({ queryKey: ["portfolio-api-credentials", portfolioId] });
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const configured = query.data ?? [];
  const needsSecret = providerRequiresSecret(provider);

  return (
    <section className="mb-6 rounded-xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-400">Portfolio API keys</h3>
          <p className="mt-0.5 text-[11px] text-gray-600">
            Optional keys for this portfolio only — Tiingo for quotes; exchange keys for Autonomous execution.
          </p>
        </div>
        <span className="text-xs text-gray-500">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-white/10 px-4 py-4">
          {configured.length > 0 ? (
            <ul className="space-y-2 text-xs">
              {configured.map((row) => (
                <li
                  key={row.provider}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2"
                >
                  <span className="text-gray-300">
                    {PORTFOLIO_API_PROVIDER_LABELS[row.provider]}{" "}
                    <span className="font-mono text-gray-500">{row.apiKeyMasked}</span>
                    {row.hasSecret ? <span className="text-gray-600"> · secret stored</span> : null}
                  </span>
                  <button
                    type="button"
                    disabled={deleteMutation.isPending}
                    onClick={() => void deleteMutation.mutate(row.provider)}
                    className="text-red-400/80 hover:text-red-300"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500">No portfolio-specific keys yet. Platform defaults apply.</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-gray-500">
              Provider
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as PortfolioApiProvider)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1524] px-3 py-2 text-sm text-white"
              >
                {PORTFOLIO_API_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {PORTFOLIO_API_PROVIDER_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-gray-500">
              API key
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={needsSecret ? "Key ID / API key" : "Tiingo API token"}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1524] px-3 py-2 font-mono text-sm text-white"
              />
            </label>
            {needsSecret ? (
              <label className="block text-xs text-gray-500 sm:col-span-2">
                API secret
                <input
                  type="password"
                  autoComplete="off"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1524] px-3 py-2 font-mono text-sm text-white"
                />
              </label>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!apiKey.trim() || saveMutation.isPending || (needsSecret && !apiSecret.trim())}
              onClick={() => {
                setMessage(null);
                void saveMutation.mutate();
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : "Save for this portfolio"}
            </button>
            {message ? <p className="text-xs text-gray-400">{message}</p> : null}
          </div>

          <p className="text-[10px] leading-relaxed text-gray-600">
            Keys are encrypted with your deployment&apos;s vault master key before storage. Pemabu never logs plaintext
            credentials. Exchange keys are used only when approving trades for this portfolio.
          </p>
        </div>
      ) : null}
    </section>
  );
}
