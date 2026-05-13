import crypto from "crypto";

export function generateShareToken(): string {
  const random = crypto.randomBytes(32).toString("hex");
  return `pemabu_share_${random}`;
}

export function hashShareToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function verifyShareToken(rawToken: string, storedHash: string): boolean {
  const candidateHash = hashShareToken(rawToken);
  const a = Buffer.from(candidateHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildShareUrl(rawToken: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/family-view?token=${encodeURIComponent(rawToken)}`;
}
