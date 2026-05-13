"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface WalletAddress {
  id: string;
  user_id: string;
  address: string;
  chain: "ethereum" | "bitcoin" | "solana" | "base" | "arbitrum" | "polygon";
  label: string | null;
  created_at: string;
}

interface OnChainPosition {
  wallet_id: string;
  address: string;
  chain: string;
  asset_symbol: string;
  asset_name: string | null;
  balance: number;
  usd_value: number | null;
  position_type: "native" | "token" | "staking" | "lp";
  protocol: string | null;
  lp_token_a?: string;
  lp_token_b?: string;
  lp_value_a?: number;
  lp_value_b?: number;
  impermanent_loss_pct?: number;
}

const CHAIN_LABELS: Record<string, string> = {
  ethereum: "Ethereum",
  bitcoin: "Bitcoin",
  solana: "Solana",
  base: "Base",
  arbitrum: "Arbitrum",
  polygon: "Polygon",
};

const CHAIN_COLORS: Record<string, string> = {
  ethereum: "text-blue-400",
  bitcoin: "text-orange-400",
  solana: "text-purple-400",
  base: "text-blue-300",
  arbitrum: "text-cyan-400",
  polygon: "text-violet-400",
};

async function fetchWallets(): Promise<WalletAddress[]> {
  const res = await fetch("/api/defi/wallets", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to fetch wallets");
  const data = (await res.json()) as { wallets: WalletAddress[] };
  return data.wallets;
}

async function addWallet(payload: { address: string; chain: WalletAddress["chain"]; label?: string }): Promise<WalletAddress> {
  const res = await fetch("/api/defi/wallets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to add wallet");
  const data = (await res.json()) as { wallet: WalletAddress };
  return data.wallet;
}

async function removeWallet(id: string): Promise<void> {
  const res = await fetch(`/api/defi/wallets/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error("Failed to remove wallet");
}

async function fetchPositions(walletIds: string[]): Promise<OnChainPosition[]> {
  if (walletIds.length === 0) return [];
  const res = await fetch(`/api/defi/positions?wallet_ids=${walletIds.map(encodeURIComponent).join(",")}`, {
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error("Failed to fetch on-chain positions");
  const data = (await res.json()) as { positions: OnChainPosition[] };
  return data.positions;
}

function calcImpermanentLoss(initialRatio: number, currentRatio: number): number {
  const r = currentRatio / initialRatio;
  const sqr = Math.sqrt(r);
  return (2 * sqr) / (1 + r) - 1;
}

export function DefiClient() {
  const qc = useQueryClient();
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [walletForm, setWalletForm] = useState({
    address: "",
    chain: "ethereum" as WalletAddress["chain"],
    label: "",
  });
  const [activeTab, setActiveTab] = useState<"positions" | "wallets" | "il_calculator">("positions");
  const [ilForm, setIlForm] = useState({
    initialPriceA: "",
    initialPriceB: "",
    currentPriceA: "",
    currentPriceB: "",
  });

  const { data: wallets = [], isPending: walletsLoading } = useQuery({
    queryKey: ["defi", "wallets"],
    queryFn: fetchWallets,
    staleTime: 5 * 60 * 1000,
  });

  const walletIdsKey = wallets.map((w) => w.id).join(",");

  const { data: positions = [], isPending: positionsLoading } = useQuery({
    queryKey: ["defi", "positions", walletIdsKey],
    queryFn: () => fetchPositions(wallets.map((w) => w.id)),
    enabled: wallets.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  const { mutate: addWalletMutation, isPending: isAdding } = useMutation({
    mutationFn: addWallet,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["defi", "wallets"] });
      setShowAddWallet(false);
      setWalletForm({ address: "", chain: "ethereum", label: "" });
    },
  });

  const { mutate: removeWalletMutation } = useMutation({
    mutationFn: removeWallet,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["defi", "wallets"] });
      void qc.invalidateQueries({ queryKey: ["defi", "positions"] });
    },
  });

  const totalUsdValue = positions.reduce((sum, p) => sum + (p.usd_value ?? 0), 0);
  const lpPositions = positions.filter((p) => p.position_type === "lp");
  const stakingPositions = positions.filter((p) => p.position_type === "staking");

  const ilResult = (() => {
    const { initialPriceA, initialPriceB, currentPriceA, currentPriceB } = ilForm;
    if (!initialPriceA || !initialPriceB || !currentPriceA || !currentPriceB) return null;
    const initialRatio = parseFloat(initialPriceA) / parseFloat(initialPriceB);
    const currentRatio = parseFloat(currentPriceA) / parseFloat(currentPriceB);
    if (!isFinite(initialRatio) || !isFinite(currentRatio) || initialRatio === 0) return null;
    return calcImpermanentLoss(initialRatio, currentRatio) * 100;
  })();

  const TABS = [
    { key: "positions" as const, label: "Positions" },
    { key: "wallets" as const, label: "Wallets" },
    { key: "il_calculator" as const, label: "IL Calculator" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-white">DeFi + On-Chain</h1>
          <p className="mt-1 text-xs text-gray-500">
            Read-only view of your on-chain positions. No signing, no transactions. Connect wallets by address only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddWallet((v) => !v)}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:border-white/20"
        >
          {showAddWallet ? "Cancel" : "+ Add Wallet"}
        </button>
      </div>

      {showAddWallet && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-gray-500">Add Read-Only Wallet</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-gray-500">Wallet Address</label>
              <input
                type="text"
                placeholder="0x… or bc1… or Solana address"
                value={walletForm.address}
                onChange={(e) => setWalletForm((f) => ({ ...f, address: e.target.value }))}
                className="w-full rounded border border-white/20 bg-white/10 px-3 py-1.5 font-mono text-xs text-white placeholder-gray-600 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Chain</label>
              <select
                value={walletForm.chain}
                onChange={(e) => setWalletForm((f) => ({ ...f, chain: e.target.value as WalletAddress["chain"] }))}
                className="w-full rounded border border-white/20 bg-[#0A1628] px-3 py-1.5 text-xs text-white outline-none"
              >
                {Object.entries(CHAIN_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Label (optional)</label>
              <input
                type="text"
                placeholder="e.g. Hardware wallet"
                value={walletForm.label}
                onChange={(e) => setWalletForm((f) => ({ ...f, label: e.target.value }))}
                className="w-full rounded border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                addWalletMutation({
                  address: walletForm.address.trim(),
                  chain: walletForm.chain,
                  label: walletForm.label.trim() || undefined,
                })
              }
              disabled={!walletForm.address.trim() || isAdding}
              className="rounded-lg bg-emerald-500 px-6 py-2 text-sm text-white hover:bg-emerald-400 disabled:opacity-50"
            >
              {isAdding ? "Adding…" : "Add Wallet"}
            </button>
            <p className="text-xs text-gray-600">Read-only. Pemabu never requests signing permissions.</p>
          </div>
        </div>
      )}

      {wallets.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Total On-Chain Value",
              value: `$${totalUsdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            },
            { label: "LP Positions", value: String(lpPositions.length) },
            { label: "Staking Positions", value: String(stakingPositions.length) },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-gray-500">{kpi.label}</p>
              <p className="mt-1 text-xl font-medium text-white">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 border-b border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-emerald-400 text-emerald-400"
                : "text-gray-500 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "positions" && (
        <>
          {walletsLoading ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading wallets…</div>
          ) : wallets.length === 0 ? (
            <div className="rounded-xl border border-white/10 py-16 text-center">
              <p className="text-sm text-gray-500">No wallets connected.</p>
              <p className="mt-1 text-xs text-gray-600">Add a wallet address to see on-chain positions.</p>
            </div>
          ) : positionsLoading ? (
            <div className="py-12 text-center text-sm text-gray-500">Fetching cached positions…</div>
          ) : positions.length === 0 ? (
            <div className="rounded-xl border border-white/10 py-16 text-center">
              <p className="text-sm text-gray-500">No cached positions for connected wallets.</p>
              <p className="mt-1 text-xs text-gray-600">A future watcher job can populate balances here.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10">
                  <tr className="text-xs text-gray-500">
                    <th className="px-4 py-3 text-left">Asset</th>
                    <th className="px-4 py-3 text-left">Chain</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Protocol</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3 text-right">USD Value</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos, i) => (
                    <tr
                      key={`${pos.wallet_id}-${pos.asset_symbol}-${i}`}
                      className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-white">{pos.asset_symbol}</p>
                        <p className="text-[10px] text-gray-500">{pos.asset_name ?? ""}</p>
                      </td>
                      <td className={`px-4 py-3 text-xs ${CHAIN_COLORS[pos.chain] ?? "text-gray-400"}`}>
                        {CHAIN_LABELS[pos.chain] ?? pos.chain}
                      </td>
                      <td className="px-4 py-3 text-xs capitalize text-gray-400">{pos.position_type}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{pos.protocol ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-white">
                        {Number(pos.balance).toLocaleString("en-US", { maximumFractionDigits: 6 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-emerald-400">
                        {pos.usd_value != null
                          ? `$${pos.usd_value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === "wallets" && (
        <div className="space-y-2">
          {wallets.length === 0 ? (
            <div className="rounded-xl border border-white/10 py-16 text-center">
              <p className="text-sm text-gray-500">No wallets connected yet.</p>
            </div>
          ) : (
            wallets.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <div>
                  <p className="font-mono text-xs text-white">{w.address}</p>
                  <p className={`mt-0.5 text-[10px] ${CHAIN_COLORS[w.chain] ?? "text-gray-400"}`}>
                    {CHAIN_LABELS[w.chain]} {w.label ? `— ${w.label}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeWalletMutation(w.id)}
                  className="text-xs text-gray-600 hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "il_calculator" && (
        <div className="space-y-6">
          <p className="text-xs text-gray-500">
            Estimate impermanent loss for a two-asset pool using price ratio change (informational).
          </p>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-widest text-gray-500">Initial prices</p>
              {(
                [
                  { label: "Token A ($)", field: "initialPriceA" as const },
                  { label: "Token B ($)", field: "initialPriceB" as const },
                ] as const
              ).map(({ label, field }) => (
                <div key={field}>
                  <label className="mb-1 block text-xs text-gray-500">{label}</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={ilForm[field]}
                    onChange={(e) => setIlForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="w-full rounded border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-widest text-gray-500">Current prices</p>
              {(
                [
                  { label: "Token A ($)", field: "currentPriceA" as const },
                  { label: "Token B ($)", field: "currentPriceB" as const },
                ] as const
              ).map(({ label, field }) => (
                <div key={field}>
                  <label className="mb-1 block text-xs text-gray-500">{label}</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={ilForm[field]}
                    onChange={(e) => setIlForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="w-full rounded border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {ilResult !== null && (
            <div
              className={`rounded-xl border p-6 ${
                Math.abs(ilResult) > 5 ? "border-red-400/20 bg-red-400/5" : "border-amber-400/20 bg-amber-400/5"
              }`}
            >
              <p className="text-xs text-gray-500">Estimated IL vs holding (ratio model)</p>
              <p className={`mt-1 text-3xl font-medium tabular-nums ${Math.abs(ilResult) > 5 ? "text-red-400" : "text-amber-400"}`}>
                {ilResult.toFixed(2)}%
              </p>
            </div>
          )}
        </div>
      )}

      <p className="text-center text-[11px] text-gray-600">
        Read-only wallet connection. Pemabu does not request, store, or transmit private keys or signing permissions.
        Not a registered investment advisor. For informational purposes only.
      </p>
    </div>
  );
}
