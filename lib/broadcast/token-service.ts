import crypto from "crypto";

export function generateBroadcastToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(24).toString("base64url");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashBroadcastToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
