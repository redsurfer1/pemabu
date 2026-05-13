"use server";

import { encryptUtf8 } from "@/lib/security/encryption";
import { isAutonomous } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { createClient } from "@/lib/supabase/server";
import type { ExchangeName } from "@/lib/execution/types";
import { upsertExchangeCredentialsVault, isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";

export async function saveExchangeCredentials(input: {
  exchange: ExchangeName;
  apiKey: string;
  apiSecret: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  const keys = await getActiveServiceKeysForUser(user.id);
  if (!isAutonomous(keys)) return { success: false, error: "Autonomous tier required" };

  const encKey = encryptUtf8(input.apiKey.trim());
  const encSecret = encryptUtf8(input.apiSecret.trim());

  if (isLocalVaultExecutionPlane()) {
    await upsertExchangeCredentialsVault({
      userId: user.id,
      exchange: input.exchange,
      encrypted_api_key: encKey.ciphertextB64,
      iv: encKey.ivB64,
      auth_tag: encKey.authTagB64,
      encrypted_secret: encSecret.ciphertextB64,
      secret_iv: encSecret.ivB64,
      secret_auth_tag: encSecret.authTagB64,
    });
    return { success: true };
  }

  const { error } = await supabase.from("exchange_credentials").upsert(
    {
      user_id: user.id,
      exchange_name: input.exchange,
      encrypted_api_key: encKey.ciphertextB64,
      iv: encKey.ivB64,
      auth_tag: encKey.authTagB64,
      encrypted_secret: encSecret.ciphertextB64,
      secret_iv: encSecret.ivB64,
      secret_auth_tag: encSecret.authTagB64,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,exchange_name" },
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}
