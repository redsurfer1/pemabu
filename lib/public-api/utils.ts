import "server-only";
import { createHash, randomBytes } from "node:crypto";

const KEY_PREFIX = "pemabu_pk_";
const KEY_BYTES = 32;

export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const raw = randomBytes(KEY_BYTES);
  const rawKey = KEY_PREFIX + raw.toString("base64url");
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 14) + "…";
  return { rawKey, keyHash, keyPrefix };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}
