import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExchangeName } from "@/lib/execution/types";
import { decryptUtf8, encryptUtf8, type EncryptedPayload } from "@/lib/security/encryption";
import { EXCHANGE_CREDENTIALS_VAULT_ONLY_MESSAGE } from "@/lib/execution/sovereign-messages";
import {
  deleteExchangeCredentialsVault,
  fetchExchangeCredentialsVault,
  isLocalVaultExecutionPlane,
  upsertExchangeCredentialsVault,
} from "@/lib/execution/vault-execution-plane";
import {
  exchangeNameFromProvider,
  isExecutionPortfolioProvider,
  maskApiKey,
  providerRequiresSecret,
  type PortfolioApiCredentialSummary,
  type PortfolioApiProvider,
} from "@/lib/portfolio/api-credentials-shared";

export type { PortfolioApiCredentialSummary, PortfolioApiProvider } from "@/lib/portfolio/api-credentials-shared";
export {
  PORTFOLIO_API_PROVIDERS,
  PORTFOLIO_API_PROVIDER_LABELS,
  exchangeNameFromProvider,
  isExecutionPortfolioProvider,
  isPortfolioApiProvider,
  providerRequiresSecret,
  maskApiKey,
} from "@/lib/portfolio/api-credentials-shared";

export class SovereignCredentialError extends Error {
  constructor(message: string = EXCHANGE_CREDENTIALS_VAULT_ONLY_MESSAGE) {
    super(message);
    this.name = "SovereignCredentialError";
  }
}

type CredentialRow = {
  portfolio_id: string;
  user_id: string;
  provider: PortfolioApiProvider;
  encrypted_api_key: string;
  encrypted_secret: string | null;
  iv: string;
  auth_tag: string;
  secret_iv: string | null;
  secret_auth_tag: string | null;
  updated_at: string;
};

function rowToEncryptedKey(row: Pick<CredentialRow, "encrypted_api_key" | "iv" | "auth_tag">): EncryptedPayload {
  return {
    ciphertextB64: row.encrypted_api_key,
    ivB64: row.iv,
    authTagB64: row.auth_tag,
  };
}

function rowToEncryptedSecret(
  row: Pick<CredentialRow, "encrypted_secret" | "secret_iv" | "secret_auth_tag" | "iv" | "auth_tag">,
): EncryptedPayload | null {
  if (!row.encrypted_secret) return null;
  return {
    ciphertextB64: row.encrypted_secret,
    ivB64: row.secret_iv ?? row.iv,
    authTagB64: row.secret_auth_tag ?? row.auth_tag,
  };
}

export async function listPortfolioApiCredentialSummaries(
  supabase: SupabaseClient,
  portfolioId: string,
): Promise<PortfolioApiCredentialSummary[]> {
  const { data, error } = await supabase
    .from("portfolio_api_credentials")
    .select("provider, encrypted_api_key, iv, auth_tag, encrypted_secret, updated_at")
    .eq("portfolio_id", portfolioId)
    .order("provider", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    let masked = "••••";
    try {
      const plain = decryptUtf8(rowToEncryptedKey(row as CredentialRow));
      masked = maskApiKey(plain);
    } catch {
      masked = "••••";
    }
    return {
      provider: row.provider as PortfolioApiProvider,
      apiKeyMasked: masked,
      hasSecret: Boolean((row as CredentialRow).encrypted_secret),
      updatedAt: String(row.updated_at),
    };
  });
}

export async function upsertPortfolioApiCredential(
  supabase: SupabaseClient,
  input: {
    portfolioId: string;
    userId: string;
    provider: PortfolioApiProvider;
    apiKey: string;
    apiSecret?: string;
  },
): Promise<void> {
  const needsSecret = providerRequiresSecret(input.provider);
  const secretPlain = input.apiSecret?.trim() ?? "";
  if (needsSecret && !secretPlain) {
    throw new Error("API secret is required for this provider");
  }

  if (isExecutionPortfolioProvider(input.provider)) {
    if (!isLocalVaultExecutionPlane()) {
      throw new SovereignCredentialError();
    }
    const exchange = exchangeNameFromProvider(input.provider);
    if (!exchange) throw new Error("Invalid execution provider");
    const encKey = encryptUtf8(input.apiKey.trim());
    const encSecret = encryptUtf8(secretPlain);
    await upsertExchangeCredentialsVault({
      userId: input.userId,
      exchange,
      encrypted_api_key: encKey.ciphertextB64,
      iv: encKey.ivB64,
      auth_tag: encKey.authTagB64,
      encrypted_secret: encSecret.ciphertextB64,
      secret_iv: encSecret.ivB64,
      secret_auth_tag: encSecret.authTagB64,
    });
    return;
  }

  const encKey = encryptUtf8(input.apiKey.trim());
  const encSecret = secretPlain ? encryptUtf8(secretPlain) : null;

  const { error } = await supabase.from("portfolio_api_credentials").upsert(
    {
      portfolio_id: input.portfolioId,
      user_id: input.userId,
      provider: input.provider,
      encrypted_api_key: encKey.ciphertextB64,
      iv: encKey.ivB64,
      auth_tag: encKey.authTagB64,
      encrypted_secret: encSecret?.ciphertextB64 ?? null,
      secret_iv: encSecret?.ivB64 ?? null,
      secret_auth_tag: encSecret?.authTagB64 ?? null,
    },
    { onConflict: "portfolio_id,provider" },
  );

  if (error) throw error;
}

export async function deletePortfolioApiCredential(
  supabase: SupabaseClient,
  portfolioId: string,
  provider: PortfolioApiProvider,
  userId: string,
): Promise<void> {
  if (isExecutionPortfolioProvider(provider)) {
    if (!isLocalVaultExecutionPlane()) {
      throw new SovereignCredentialError();
    }
    const exchange = exchangeNameFromProvider(provider);
    if (exchange) await deleteExchangeCredentialsVault(userId, exchange);
    return;
  }

  const { error } = await supabase
    .from("portfolio_api_credentials")
    .delete()
    .eq("portfolio_id", portfolioId)
    .eq("provider", provider);
  if (error) throw error;
}

export async function getPortfolioTiingoToken(
  supabase: SupabaseClient,
  portfolioId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("portfolio_api_credentials")
    .select("encrypted_api_key, iv, auth_tag")
    .eq("portfolio_id", portfolioId)
    .eq("provider", "tiingo")
    .maybeSingle();

  if (error || !data) return null;

  try {
    return decryptUtf8(rowToEncryptedKey(data as CredentialRow));
  } catch {
    return null;
  }
}

export type DecryptedExchangeCredential = {
  apiKey: string;
  apiSecret: string;
};

export async function getPortfolioExchangeCredential(
  supabase: SupabaseClient,
  portfolioId: string,
  exchange: ExchangeName,
  userId?: string,
): Promise<DecryptedExchangeCredential | null> {
  if (isLocalVaultExecutionPlane() && userId) {
    const row = await fetchExchangeCredentialsVault(userId, exchange);
    if (!row) return null;
    try {
      const apiKey = decryptUtf8({
        ciphertextB64: row.encrypted_api_key,
        ivB64: row.iv,
        authTagB64: row.auth_tag,
      });
      const apiSecret = decryptUtf8({
        ciphertextB64: row.encrypted_secret,
        ivB64: row.secret_iv ?? row.iv,
        authTagB64: row.secret_auth_tag ?? row.auth_tag,
      });
      return { apiKey, apiSecret };
    } catch {
      return null;
    }
  }

  const { data, error } = await supabase
    .from("portfolio_api_credentials")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .eq("provider", exchange)
    .maybeSingle();

  if (error || !data) return null;

  try {
    const apiKey = decryptUtf8(rowToEncryptedKey(data as CredentialRow));
    const secretPayload = rowToEncryptedSecret(data as CredentialRow);
    const apiSecret = secretPayload ? decryptUtf8(secretPayload) : "";
    return { apiKey, apiSecret };
  } catch {
    return null;
  }
}
