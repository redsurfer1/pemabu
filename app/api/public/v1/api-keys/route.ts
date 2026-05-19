import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateApiKey } from "@/lib/public-api/utils";
import { checkRateLimit, MUTATION_RATE_LIMIT } from "@/lib/security/rate-limiter";

const CreateKeyBody = z.object({
  label: z.string().max(100).default(""),
  scopes: z.array(z.string()).default([]),
});

export const GET = withAuth(async (_req, user) => {
  const { data, error } = await supabaseAdmin
    .from("public_api_keys")
    .select("id, label, key_prefix, scopes, is_active, last_used_at, created_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to list API keys" }, { status: 500 });
  }

  const keys = (data ?? []).map((r) => ({
    id: String(r.id),
    label: String(r.label),
    keyPrefix: String(r.key_prefix),
    scopes: (r as { scopes: string[] }).scopes ?? [],
    isActive: Boolean(r.is_active),
    lastUsedAt: (r as { last_used_at: string | null }).last_used_at,
    createdAt: String(r.created_at),
    revokedAt: (r as { revoked_at: string | null }).revoked_at,
  }));

  return NextResponse.json({ data: keys });
});

export const POST = withAuth(async (req, user) => {
  const rl = await checkRateLimit({ key: `mutation:${user.id}`, ...MUTATION_RATE_LIMIT });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down.", code: "RATE_LIMITED", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429 },
    );
  }

  let parsed: z.infer<typeof CreateKeyBody>;
  try {
    const body = (await req.json()) as unknown;
    parsed = CreateKeyBody.parse(body);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { rawKey, keyHash, keyPrefix } = generateApiKey();

  const { data, error } = await supabaseAdmin
    .from("public_api_keys")
    .insert({
      user_id: user.id,
      label: parsed.label,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes: parsed.scopes,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }

  return NextResponse.json({
    id: String((data as { id: string }).id),
    label: parsed.label,
    rawKey,
    keyPrefix,
    scopes: parsed.scopes,
  });
});
