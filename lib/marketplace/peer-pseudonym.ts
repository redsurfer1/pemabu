import { createHash } from "node:crypto";

/** Stable, non-reversible display tag for leaderboard rows (not a user id). */
export function strategyPeerPseudonym(strategyId: string): string {
  const h = createHash("sha256").update(`pemabu.peer:${strategyId}`).digest("hex").slice(0, 10);
  return `Peer-${h}`;
}
