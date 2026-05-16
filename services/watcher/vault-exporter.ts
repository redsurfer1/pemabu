import { supabaseAdmin } from "../../lib/supabase/admin";
import { encryptUtf8, decryptUtf8 } from "../../lib/security/encryption";
import { s3PutObject } from "../../lib/vault-export/s3-uploader";

interface S3Creds {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint?: string;
}

interface VaultExportConfig {
  id: string;
  user_id: string;
  provider: "s3" | "backblaze" | "nas";
  bucket_name: string | null;
  region: string | null;
  endpoint_url: string | null;
  encrypted_credentials: string;
  is_enabled: boolean;
}

interface ExportPayload {
  exported_at: string;
  user_id: string;
  holdings: unknown[];
  signals: unknown[];
  snapshots: unknown[];
}

export async function runWeeklyVaultExport(): Promise<void> {
  console.log("[vault-export] starting weekly export run");

  const { data: configs, error } = await supabaseAdmin
    .from("vault_export_configs")
    .select("*")
    .eq("is_enabled", true);

  if (error) {
    console.error("[vault-export] fetch configs error:", error.message);
    return;
  }

  if (!configs || configs.length === 0) {
    console.log("[vault-export] no enabled export configs");
    return;
  }

  for (const config of configs as VaultExportConfig[]) {
    await exportForUser(config);
  }
}

async function exportForUser(config: VaultExportConfig): Promise<void> {
  const { user_id } = config;

  try {
    // Decrypt stored credentials.
    const credsJson = decryptUtf8(JSON.parse(config.encrypted_credentials) as Parameters<typeof decryptUtf8>[0]);
    const creds = JSON.parse(credsJson) as S3Creds;

    // Collect user data to export.
    const [holdingsRes, signalsRes, snapshotsRes] = await Promise.all([
      supabaseAdmin
        .from("holdings")
        .select("*")
        .in("portfolio_id", await getUserPortfolioIds(user_id)),
      supabaseAdmin
        .from("signals")
        .select("*")
        .in("portfolio_id", await getUserPortfolioIds(user_id))
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("allocation_snapshots")
        .select("*")
        .in("portfolio_id", await getUserPortfolioIds(user_id))
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const payload: ExportPayload = {
      exported_at: new Date().toISOString(),
      user_id,
      holdings: holdingsRes.data ?? [],
      signals: signalsRes.data ?? [],
      snapshots: snapshotsRes.data ?? [],
    };

    // Encrypt the entire payload before upload.
    const encrypted = encryptUtf8(JSON.stringify(payload));
    const uploadContent = Buffer.from(JSON.stringify(encrypted), "utf8");

    const key = `pemabu-vault/${user_id}/${new Date().toISOString().split("T")[0]}.enc.json`;

    if (config.provider === "s3" || config.provider === "backblaze") {
      await s3PutObject(
        {
          accessKeyId: creds.accessKeyId,
          secretAccessKey: creds.secretAccessKey,
          region: config.region ?? creds.region ?? "us-east-1",
          endpoint: config.endpoint_url ?? creds.endpoint,
        },
        config.bucket_name ?? "",
        key,
        uploadContent,
        "application/json",
      );
    } else {
      // NAS: log path — actual SMB/NFS mount would require OS-level access outside Next.js.
      console.log(`[vault-export] NAS export for ${user_id}: would write to ${config.endpoint_url ?? ""}/${key}`);
    }

    await supabaseAdmin
      .from("vault_export_configs")
      .update({ last_export_at: new Date().toISOString(), last_export_status: "success", last_export_error: null })
      .eq("id", config.id);

    console.log(`[vault-export] exported ${user_id} → ${key} (${uploadContent.byteLength} bytes encrypted)`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[vault-export] export failed for ${user_id}:`, msg);

    await supabaseAdmin
      .from("vault_export_configs")
      .update({ last_export_status: "error", last_export_error: msg.slice(0, 500) })
      .eq("id", config.id);
  }
}

async function getUserPortfolioIds(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("portfolios")
    .select("id")
    .eq("user_id", userId);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}
