import { createHash } from "node:crypto";

/** Stable public creator slug — not reversible to auth.users id. */
export function publicCreatorId(userId: string): string {
  return createHash("sha256").update(`pemabu-creator-${userId}`).digest("hex").slice(0, 16);
}
