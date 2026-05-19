"use server";

import { d } from "@/lib/portfolio/precision-money";
import { insertHoldingAuditRow, type HoldingAuditInsert } from "@/lib/portfolio/holding-audit";
import { isAutonomous } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { createClient } from "@/lib/supabase/server";
import { toRecordOrNull } from "@/lib/supabase/typed";
import { decryptUtf8 } from "@/lib/security/encryption";
import {
  appendErrorCode,
  assertKillSwitch,
  buildGuardrailContext,
  shouldCircuitLockFromErrorCodes,
} from "@/lib/execution/guardrails";
import { dispatchOrder } from "@/lib/execution/registry";
import type { ExchangeName } from "@/lib/execution/types";
import {
  assertPortfolioExecutionUnlocked,
  validateTradeAgainstLimits,
} from "@/lib/execution/validate-trade-limits";
import {
  evaluateCircuitBreakerAfterOutcomeSupabase,
  evaluateCircuitBreakerAfterOutcomeVault,
  fetchPortfolioSystemStatusSupabase,
  fetchPortfolioSystemStatusVault,
  insertExecutionOutcomeSupabase,
  insertExecutionOutcomeVault,
} from "@/lib/execution/execution-outcomes";
import { getPortfolioExchangeCredential } from "@/lib/portfolio/api-credentials";
import {
  VAULT_REQUIRED_CODE,
  VAULT_REQUIRED_MESSAGE,
} from "@/lib/execution/sovereign-messages";
import {
  buildGuardrailContextVault,
  fetchExchangeCredentialsVault,
  fetchSleeveHoldingQtyPriceVault,
  fetchTradeProposalVault,
  insertDailyExecutionLogVault,
  insertHoldingAuditVault,
  updateExecutionControlVault,
  updateTradeProposalStatusVault,
  isLocalVaultExecutionPlane,
} from "@/lib/execution/vault-execution-plane";

const STUB_ERROR = process.env.PEMABU_STUB_FORCE_TRADE_ERROR;

function asProposalRow(raw: Record<string, unknown>) {
  return {
    id: String(raw.id),
    portfolio_id: String(raw.portfolio_id),
    sleeve_id: String(raw.sleeve_id),
    holding_id: raw.holding_id != null ? String(raw.holding_id) : null,
    ticker: String(raw.ticker),
    action: raw.action as "BUY" | "SELL",
    quantity: String(raw.quantity),
    exchange_name: (raw.exchange_name as ExchangeName) ?? "alpaca",
  };
}

export async function approveTradeProposal(proposalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  const keys = await getActiveServiceKeysForUser(user.id);
  if (!isAutonomous(keys)) {
    return { success: false, error: "Autonomous tier required" };
  }

  if (!isLocalVaultExecutionPlane()) {
    return {
      success: false,
      error: VAULT_REQUIRED_MESSAGE,
      code: VAULT_REQUIRED_CODE,
    };
  }

  const vault = true;

  const audit = async (r: HoldingAuditInsert) => {
    if (vault) await insertHoldingAuditVault(r);
    else await insertHoldingAuditRow(supabase, r);
  };

  const setProposalStatus = async (status: string) => {
    if (vault) await updateTradeProposalStatusVault(proposalId, status);
    else {
      await supabase
        .from("trade_proposals")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", proposalId);
    }
  };

  let proposalRaw: Record<string, unknown> | null = null;
  if (vault) {
    proposalRaw = toRecordOrNull(await fetchTradeProposalVault(user.id, proposalId));
  } else {
    const { data: proposal, error: pErr } = await supabase
      .from("trade_proposals")
      .select("*")
      .eq("id", proposalId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (pErr) return { success: false, error: pErr.message };
    proposalRaw = toRecordOrNull(proposal);
  }

  if (!proposalRaw) return { success: false, error: "Proposal not found" };
  if (String(proposalRaw.status) !== "PENDING") {
    return { success: false, error: "Proposal is not pending" };
  }

  const row = asProposalRow(proposalRaw);

  const systemStatus = vault
    ? await fetchPortfolioSystemStatusVault(row.portfolio_id, user.id)
    : await fetchPortfolioSystemStatusSupabase(supabase, row.portfolio_id, user.id);
  if (systemStatus === null) return { success: false, error: "Portfolio not found" };

  const portfolioLock = assertPortfolioExecutionUnlocked(systemStatus);
  if (portfolioLock) {
    await setProposalStatus("REJECTED");
    await audit({
      userId: user.id,
      portfolioId: row.portfolio_id,
      sleeveId: row.sleeve_id,
      holdingId: row.holding_id,
      eventType: "TRADE_PROPOSAL_REJECTED",
      ticker: row.ticker,
      quantityBefore: null,
      quantityAfter: row.quantity,
      costBasisBefore: null,
      costBasisAfter: null,
      notes: { reason: portfolioLock, proposalId },
    });
    return { success: false, error: portfolioLock };
  }

  if (!row.holding_id) return { success: false, error: "Proposal missing holding reference" };

  let holding: { price_seed: string } | null = null;
  if (vault) {
    const h = await fetchSleeveHoldingQtyPriceVault(row.holding_id);
    holding = h ? { price_seed: h.price_seed } : null;
  } else {
    const { data: h } = await supabase
      .from("sleeve_holdings")
      .select("qty, price_seed")
      .eq("id", row.holding_id)
      .maybeSingle();
    holding = h as { price_seed: string } | null;
  }
  if (!holding) return { success: false, error: "Holding not found for proposal" };

  const price = d(String(holding.price_seed));
  const execQty = d(row.quantity);
  const tradeNotional = execQty.mul(price);

  const ctx = vault
    ? await buildGuardrailContextVault(user.id, row.portfolio_id, tradeNotional)
    : await buildGuardrailContext(supabase, user.id, row.portfolio_id, tradeNotional);

  const kill = assertKillSwitch(ctx.control);
  if (kill) {
    await setProposalStatus("REJECTED");
    await audit({
      userId: user.id,
      portfolioId: row.portfolio_id,
      sleeveId: row.sleeve_id,
      holdingId: row.holding_id,
      eventType: "TRADE_PROPOSAL_REJECTED",
      ticker: row.ticker,
      quantityBefore: null,
      quantityAfter: row.quantity,
      costBasisBefore: null,
      costBasisAfter: null,
      notes: { reason: kill, proposalId },
    });
    return { success: false, error: kill };
  }

  const limits = validateTradeAgainstLimits({
    proposal: {
      portfolioId: row.portfolio_id,
      userId: user.id,
      tradeNotionalUsd: tradeNotional,
    },
    control: ctx.control,
    portfolioNavUsd: ctx.portfolioNav,
    rolling24hNotionalUsd: ctx.rolling24hNotional,
  });
  if (!limits.ok) {
    await setProposalStatus("REJECTED");
    await audit({
      userId: user.id,
      portfolioId: row.portfolio_id,
      sleeveId: row.sleeve_id,
      holdingId: row.holding_id,
      eventType: "TRADE_PROPOSAL_REJECTED",
      ticker: row.ticker,
      quantityBefore: null,
      quantityAfter: row.quantity,
      costBasisBefore: null,
      costBasisAfter: null,
      notes: { reason: limits.code, proposalId },
    });
    return { success: false, error: limits.code };
  }

  const portfolioCred = await getPortfolioExchangeCredential(
    supabase,
    row.portfolio_id,
    row.exchange_name as ExchangeName,
    user.id,
  );

  const userCred = portfolioCred
    ? null
    : vault
      ? await fetchExchangeCredentialsVault(user.id, row.exchange_name)
      : (
          await supabase
            .from("exchange_credentials")
            .select("*")
            .eq("user_id", user.id)
            .eq("exchange_name", row.exchange_name)
            .maybeSingle()
        ).data;

  if (!portfolioCred && !userCred) {
    await audit({
      userId: user.id,
      portfolioId: row.portfolio_id,
      sleeveId: row.sleeve_id,
      holdingId: row.holding_id,
      eventType: "TRADE_PROPOSAL_REJECTED",
      ticker: row.ticker,
      quantityBefore: null,
      quantityAfter: row.quantity,
      costBasisBefore: null,
      costBasisAfter: null,
      notes: { reason: "NO_EXCHANGE_CREDENTIALS", proposalId },
    });
    return { success: false, error: "No encrypted credentials for this exchange" };
  }

  await audit({
    userId: user.id,
    portfolioId: row.portfolio_id,
    sleeveId: row.sleeve_id,
    holdingId: row.holding_id,
    eventType: "TRADE_EXECUTION_ATTEMPT",
    ticker: row.ticker,
    quantityBefore: null,
    quantityAfter: row.quantity,
    costBasisBefore: null,
    costBasisAfter: null,
    notes: { proposalId, exchange: row.exchange_name },
  });

  let apiKey = "";
  let apiSecret = "";
  try {
    if (portfolioCred) {
      apiKey = portfolioCred.apiKey;
      apiSecret = portfolioCred.apiSecret;
    } else {
      apiKey = decryptUtf8({
        ciphertextB64: (userCred as { encrypted_api_key: string }).encrypted_api_key,
        ivB64: (userCred as { iv: string }).iv,
        authTagB64: (userCred as { auth_tag: string }).auth_tag,
      });
      apiSecret = decryptUtf8({
        ciphertextB64: (userCred as { encrypted_secret: string }).encrypted_secret,
        ivB64: (userCred as { secret_iv: string | null }).secret_iv ?? (userCred as { iv: string }).iv,
        authTagB64:
          (userCred as { secret_auth_tag: string | null }).secret_auth_tag ??
          (userCred as { auth_tag: string }).auth_tag,
      });
    }
  } catch (e) {
    apiKey = "";
    apiSecret = "";
    await audit({
      userId: user.id,
      portfolioId: row.portfolio_id,
      sleeveId: row.sleeve_id,
      holdingId: row.holding_id,
      eventType: "TRADE_EXECUTION_FAILURE",
      ticker: row.ticker,
      quantityBefore: null,
      quantityAfter: row.quantity,
      costBasisBefore: null,
      costBasisAfter: null,
      notes: { proposalId, error: "DECRYPT_FAILED", detail: String(e) },
    });
    await setProposalStatus("REJECTED");
    if (vault) {
      await insertExecutionOutcomeVault({
        portfolioId: row.portfolio_id,
        userId: user.id,
        proposalId,
        succeeded: false,
        errorCode: "DECRYPT_FAILED",
      });
      await evaluateCircuitBreakerAfterOutcomeVault(row.portfolio_id, {
        succeeded: false,
        errorCode: "DECRYPT_FAILED",
      });
    } else {
      await insertExecutionOutcomeSupabase(supabase, {
        portfolioId: row.portfolio_id,
        userId: user.id,
        proposalId,
        succeeded: false,
        errorCode: "DECRYPT_FAILED",
      });
      await evaluateCircuitBreakerAfterOutcomeSupabase(supabase, row.portfolio_id, {
        succeeded: false,
        errorCode: "DECRYPT_FAILED",
      });
    }
    return { success: false, error: "Credential decrypt failed" };
  }

  await setProposalStatus("APPROVED");
  await audit({
    userId: user.id,
    portfolioId: row.portfolio_id,
    sleeveId: row.sleeve_id,
    holdingId: row.holding_id,
    eventType: "TRADE_PROPOSAL_APPROVED",
    ticker: row.ticker,
    quantityBefore: null,
    quantityAfter: row.quantity,
    costBasisBefore: null,
    costBasisAfter: null,
    notes: { proposalId },
  });

  const side = row.action === "BUY" ? "buy" : "sell";
  let result = await dispatchOrder(
    row.exchange_name,
    { ticker: row.ticker, side, quantity: row.quantity, notionalUsd: tradeNotional.toFixed(4) },
    apiKey,
    apiSecret,
  );

  apiKey = "";
  apiSecret = "";

  if (STUB_ERROR) {
    result = { ok: false, errorCode: STUB_ERROR };
  }

  if (!result.ok) {
    const code = result.errorCode ?? (result.error ? "EXCHANGE_ERROR" : "UNKNOWN");
    const codes = appendErrorCode(ctx.control.last_error_codes, code);
    const lock = shouldCircuitLockFromErrorCodes(codes);
    if (vault) {
      await updateExecutionControlVault(user.id, {
        consecutive_api_failures: (ctx.control.consecutive_api_failures ?? 0) + 1,
        last_error_codes: codes,
        circuit_locked: lock,
      });
    } else {
      await supabase
        .from("execution_control")
        .update({
          consecutive_api_failures: (ctx.control.consecutive_api_failures ?? 0) + 1,
          last_error_codes: codes,
          circuit_locked: lock,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    }

    await audit({
      userId: user.id,
      portfolioId: row.portfolio_id,
      sleeveId: row.sleeve_id,
      holdingId: row.holding_id,
      eventType: "TRADE_EXECUTION_FAILURE",
      ticker: row.ticker,
      quantityBefore: null,
      quantityAfter: row.quantity,
      costBasisBefore: null,
      costBasisAfter: null,
      notes: { proposalId, errorCode: code, circuitLocked: lock },
    });
    await setProposalStatus("REJECTED");
    if (vault) {
      await insertExecutionOutcomeVault({
        portfolioId: row.portfolio_id,
        userId: user.id,
        proposalId,
        succeeded: false,
        errorCode: code,
      });
      await evaluateCircuitBreakerAfterOutcomeVault(row.portfolio_id, { succeeded: false, errorCode: code });
    } else {
      await insertExecutionOutcomeSupabase(supabase, {
        portfolioId: row.portfolio_id,
        userId: user.id,
        proposalId,
        succeeded: false,
        errorCode: code,
      });
      await evaluateCircuitBreakerAfterOutcomeSupabase(supabase, row.portfolio_id, {
        succeeded: false,
        errorCode: code,
      });
    }
    return { success: false, error: code };
  }

  await setProposalStatus("EXECUTED");
  if (vault) {
    await insertDailyExecutionLogVault({
      userId: user.id,
      notionalUsd: Number(tradeNotional.toFixed(4)),
      proposalId,
      exchangeName: row.exchange_name,
      result: "OK",
      errorCode: null,
    });
    await updateExecutionControlVault(user.id, {
      consecutive_api_failures: 0,
      last_error_codes: [],
      circuit_locked: false,
    });
  } else {
    await supabase.from("daily_execution_logs").insert({
      user_id: user.id,
      notional_usd: Number(tradeNotional.toFixed(4)),
      proposal_id: proposalId,
      exchange_name: row.exchange_name,
      result: "OK",
      error_code: null,
    });

    await supabase
      .from("execution_control")
      .update({
        consecutive_api_failures: 0,
        last_error_codes: [],
        circuit_locked: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
  }

  await audit({
    userId: user.id,
    portfolioId: row.portfolio_id,
    sleeveId: row.sleeve_id,
    holdingId: row.holding_id,
    eventType: "TRADE_EXECUTION_SUCCESS",
    ticker: row.ticker,
    quantityBefore: null,
    quantityAfter: row.quantity,
    costBasisBefore: null,
    costBasisAfter: null,
    notes: { proposalId, externalId: result.externalId },
  });

  if (vault) {
    await insertExecutionOutcomeVault({
      portfolioId: row.portfolio_id,
      userId: user.id,
      proposalId,
      succeeded: true,
      errorCode: null,
    });
    await evaluateCircuitBreakerAfterOutcomeVault(row.portfolio_id, { succeeded: true, errorCode: null });
  } else {
    await insertExecutionOutcomeSupabase(supabase, {
      portfolioId: row.portfolio_id,
      userId: user.id,
      proposalId,
      succeeded: true,
      errorCode: null,
    });
    await evaluateCircuitBreakerAfterOutcomeSupabase(supabase, row.portfolio_id, {
      succeeded: true,
      errorCode: null,
    });
  }

  return { success: true };
}
