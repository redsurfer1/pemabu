/**
 * Daily sync of native chain balances for rows in `defi_wallets` (Supabase).
 * Uses only public RPC / HTTP endpoints (no API keys).
 */

import Decimal from "decimal.js";
import { supabaseAdmin } from "../../lib/supabase/admin";

type DefiChain = "ethereum" | "bitcoin" | "solana" | "base" | "arbitrum" | "polygon";

type WalletRow = {
  id: string;
  address: string;
  chain: string;
};

const EVM_RPC: Record<Exclude<DefiChain, "bitcoin" | "solana">, string> = {
  ethereum: "https://ethereum.publicnode.com",
  base: "https://mainnet.base.org",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  polygon: "https://polygon-bor.publicnode.com",
};

const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

const NATIVE_META: Record<
  DefiChain,
  { symbol: string; name: string }
> = {
  ethereum: { symbol: "ETH", name: "Ether" },
  base: { symbol: "ETH", name: "Ether" },
  arbitrum: { symbol: "ETH", name: "Ether" },
  polygon: { symbol: "MATIC", name: "MATIC" },
  bitcoin: { symbol: "BTC", name: "Bitcoin" },
  solana: { symbol: "SOL", name: "Solana" },
};

function isDefiChain(c: string): c is DefiChain {
  return (
    c === "ethereum" ||
    c === "bitcoin" ||
    c === "solana" ||
    c === "base" ||
    c === "arbitrum" ||
    c === "polygon"
  );
}

function normalizeEvmAddress(addr: string): string | null {
  const t = addr.trim();
  const hex = t.startsWith("0x") ? t.slice(2) : t;
  if (!/^[0-9a-fA-F]{40}$/.test(hex)) return null;
  return `0x${hex.toLowerCase()}`;
}

async function jsonRpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) {
    throw new Error(`RPC ${method} HTTP ${String(res.status)}`);
  }
  const payload = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (payload.error) {
    throw new Error(payload.error.message ?? "RPC error");
  }
  return payload.result;
}

async function evmNativeBalanceEth(rpcUrl: string, address: string): Promise<string> {
  const norm = normalizeEvmAddress(address);
  if (!norm) throw new Error("invalid EVM address");
  const result = await jsonRpc(rpcUrl, "eth_getBalance", [norm, "latest"]);
  if (typeof result !== "string" || !result.startsWith("0x")) {
    throw new Error("unexpected eth_getBalance result");
  }
  const wei = BigInt(result);
  return new Decimal(wei.toString()).div("1e18").toDecimalPlaces(8, Decimal.ROUND_DOWN).toFixed(8);
}

async function solanaNativeBalance(address: string): Promise<string> {
  const trimmed = address.trim();
  if (!trimmed) throw new Error("empty Solana address");
  const result = await jsonRpc(SOLANA_RPC, "getBalance", [trimmed]);
  if (result == null || typeof result !== "object" || !("value" in result)) {
    throw new Error("unexpected getBalance result");
  }
  const v = (result as { value: number }).value;
  if (!Number.isFinite(v)) throw new Error("invalid lamports");
  return new Decimal(v).div("1e9").toDecimalPlaces(8, Decimal.ROUND_DOWN).toFixed(8);
}

/** blockchain.info: `/balance?active=addr1|addr2|...` — balances in satoshis */
async function blockchainInfoBalances(
  addresses: string[],
): Promise<Map<string, bigint>> {
  const out = new Map<string, bigint>();
  const chunkSize = 25;
  for (let i = 0; i < addresses.length; i += chunkSize) {
    const chunk = addresses.slice(i, i + chunkSize);
    const active = chunk.map((a) => encodeURIComponent(a.trim())).join("|");
    const url = `https://blockchain.info/balance?active=${active}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`blockchain.info HTTP ${String(res.status)}`);
    const payload = (await res.json()) as Record<string, { final_balance?: number }>;
    for (const addr of chunk) {
      const row = payload[addr.trim()];
      if (row && typeof row.final_balance === "number" && Number.isFinite(row.final_balance)) {
        out.set(addr.trim(), BigInt(row.final_balance));
      }
    }
  }
  return out;
}

async function fetchNativeBalanceEvmOrSol(row: WalletRow): Promise<string> {
  const chain = row.chain;
  if (!isDefiChain(chain)) {
    throw new Error(`unsupported chain: ${chain}`);
  }
  if (chain === "bitcoin") {
    throw new Error("use batched Bitcoin fetch");
  }
  if (chain === "solana") {
    return solanaNativeBalance(row.address);
  }
  const rpc = EVM_RPC[chain];
  return evmNativeBalanceEth(rpc, row.address);
}

export async function runDailyDeFiNativeBalanceSync(): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.warn("[watcher] DeFi native sync skipped — Supabase admin env not set");
    return;
  }

  console.log("[watcher] DeFi native balance sync…");

  const { data: wallets, error } = await supabaseAdmin
    .from("defi_wallets")
    .select("id, address, chain");

  if (error) {
    console.error("[watcher] defi_wallets:", error.message);
    return;
  }

  const list = (wallets ?? []) as WalletRow[];
  if (list.length === 0) {
    console.log("[watcher] no defi_wallets — skipping native sync.");
    return;
  }

  const nowIso = new Date().toISOString();
  const upsertRows: Record<string, unknown>[] = [];

  const btcRows = list.filter((w) => w.chain === "bitcoin");
  let btcBalances: Map<string, bigint> = new Map();
  if (btcRows.length > 0) {
    try {
      btcBalances = await blockchainInfoBalances(btcRows.map((w) => w.address));
    } catch (e) {
      console.error("[watcher] blockchain.info batch failed:", e);
    }
  }

  for (const w of list) {
    try {
      let balanceStr: string;
      if (w.chain === "bitcoin") {
        const sat = btcBalances.get(w.address.trim());
        if (sat == null) {
          throw new Error("missing BTC balance in batch response");
        }
        balanceStr = new Decimal(sat.toString())
          .div("1e8")
          .toDecimalPlaces(8, Decimal.ROUND_DOWN)
          .toFixed(8);
      } else {
        balanceStr = await fetchNativeBalanceEvmOrSol(w);
      }

      if (!isDefiChain(w.chain)) continue;
      const meta = NATIVE_META[w.chain];
      upsertRows.push({
        wallet_id: w.id,
        address: w.address.trim(),
        chain: w.chain,
        asset_symbol: meta.symbol,
        asset_name: meta.name,
        balance: balanceStr,
        usd_value: null,
        position_type: "native",
        protocol: null,
        lp_token_a: null,
        lp_token_b: null,
        lp_value_a: null,
        lp_value_b: null,
        impermanent_loss_pct: null,
        fetched_at: nowIso,
      });
    } catch (err) {
      console.error(`[watcher] defi native balance failed wallet=${w.id} chain=${w.chain}:`, err);
    }
  }

  if (upsertRows.length === 0) {
    console.log("[watcher] DeFi native sync: nothing to upsert.");
    return;
  }

  const batchSize = 40;
  for (let i = 0; i < upsertRows.length; i += batchSize) {
    const slice = upsertRows.slice(i, i + batchSize);
    const { error: upErr } = await supabaseAdmin.from("defi_positions").upsert(slice, {
      onConflict: "wallet_id,asset_symbol,position_type",
    });
    if (upErr) {
      console.error("[watcher] defi_positions upsert:", upErr.message);
      return;
    }
  }

  console.log(`[watcher] DeFi native sync updated ${String(upsertRows.length)} position row(s).`);
}
