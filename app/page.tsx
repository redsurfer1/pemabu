import HomePage from "@/components/home/HomePage";
import type { LeaderboardPreviewItem } from "@/components/home/leaderboard-preview";
import { getBaseUrl } from "@/lib/app-url";
import { strategyPeerPseudonym } from "@/lib/marketplace/peer-pseudonym";

async function getLeaderboardPreview(): Promise<LeaderboardPreviewItem[]> {
  const base = getBaseUrl();
  try {
    const res = await fetch(`${base}/api/public/leaderboard`, { next: { revalidate: 120 } });
    if (!res.ok) return [];
    const j = (await res.json()) as {
      data: Array<{ id: string; strategy_grade: number; subscriber_count: number }>;
    };
    return (j.data ?? []).map((r) => ({
      id: r.id,
      pseudonym: strategyPeerPseudonym(r.id),
      strategy_grade: r.strategy_grade,
      subscriber_count: r.subscriber_count,
    }));
  } catch {
    return [];
  }
}

export default async function Home() {
  const leaderboardPreview = await getLeaderboardPreview();
  return <HomePage leaderboardPreview={leaderboardPreview} />;
}
