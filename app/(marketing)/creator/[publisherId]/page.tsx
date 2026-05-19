import Link from "next/link";
import { notFound } from "next/navigation";
import MarketingNav from "@/components/home/MarketingNav";
import { SiteLegalFooter } from "@/components/legal/SiteLegalFooter";
import { PerformanceSparkline } from "@/components/marketplace/PerformanceSparkline";
import { FoundingPublisherBadge } from "@/components/marketplace/FoundingPublisherBadge";
import { getBaseUrl } from "@/lib/app-url";
import { AI_DISCLAIMER } from "@/lib/constants/ai-models";
import type { SleevePerformanceWeek } from "@/lib/types/sleeve-performance";

interface CreatorProfile {
  creatorId: string;
  isFoundingPublisher: boolean;
  totalStrategies: number;
  totalImports: number;
  totalRoyaltyTokensEquivalent: number;
  strategies: Array<{
    id: string;
    displayName: string;
    grade: number | string;
    isFoundingPublisher: boolean;
    performanceHistory: SleevePerformanceWeek[];
  }>;
  recentMemo: {
    periodLabel: string;
    generatedAt: string;
    preview: string;
  } | null;
  notice: string;
}

async function getCreatorProfile(publisherId: string): Promise<CreatorProfile | null> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/api/public/creator/${publisherId}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  return res.json() as Promise<CreatorProfile>;
}

function consistencyFromHistory(history: SleevePerformanceWeek[]): "new" | "consistent" | "variable" {
  if (history.length < 4) return "new";
  const avg =
    history.reduce((s, h) => s + (h.avg_drift_pct ?? 0), 0) / Math.max(history.length, 1);
  return avg < 5 ? "consistent" : "variable";
}

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ publisherId: string }>;
}) {
  const { publisherId } = await params;
  const profile = await getCreatorProfile(publisherId);
  if (!profile) notFound();

  return (
    <div className="min-h-screen bg-[#0A1628] text-gray-200">
      <MarketingNav />
      <div className="container mx-auto max-w-3xl px-6 pb-16 pt-24">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-lg font-bold text-emerald-400"
              aria-hidden
            >
              {publisherId[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">
                Creator {publisherId.slice(0, 8).toUpperCase()}
              </h1>
              {profile.isFoundingPublisher ? <FoundingPublisherBadge className="mt-1" /> : null}
            </div>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-2xl font-bold tabular-nums text-white">{profile.totalStrategies}</p>
              <p className="text-xs text-gray-500">
                {profile.totalStrategies === 1 ? "Strategy" : "Strategies"}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-white">{profile.totalImports}</p>
              <p className="text-xs text-gray-500">Total Imports</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-white">
                {profile.totalRoyaltyTokensEquivalent}
              </p>
              <p className="text-xs text-gray-500">Tokens Earned</p>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-md border border-amber-500/30 bg-amber-950/20 px-3 py-2">
          <p className="text-xs text-amber-200/90">⚠️ {profile.notice}</p>
        </div>

        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-white">Published Strategies</h2>
          <div className="space-y-3">
            {profile.strategies.map((strategy) => {
              const consistency = consistencyFromHistory(strategy.performanceHistory);
              return (
                <div
                  key={strategy.id}
                  className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-black/20 px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{strategy.displayName}</p>
                      {strategy.isFoundingPublisher ? <FoundingPublisherBadge /> : null}
                    </div>
                    <PerformanceSparkline
                      history={strategy.performanceHistory}
                      consistency={consistency}
                      weeksTracked={strategy.performanceHistory.length}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold tabular-nums text-emerald-300">
                      {typeof strategy.grade === "number" ? strategy.grade.toFixed(0) : strategy.grade}
                    </p>
                    <p className="text-xs text-gray-500">Score</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {profile.recentMemo ? (
          <section className="mb-8">
            <h2 className="mb-3 text-base font-semibold text-white">
              Strategy Council Analysis
              <span className="ml-2 text-xs font-normal text-gray-500">
                {profile.recentMemo.periodLabel}
              </span>
            </h2>
            <div className="rounded-md border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-sm leading-relaxed text-gray-400">{profile.recentMemo.preview}</p>
            </div>
            <p className="mt-2 text-xs text-gray-500 italic">{AI_DISCLAIMER}</p>
          </section>
        ) : null}

        <div className="rounded-md border border-white/10 bg-black/20 px-4 py-4 text-center">
          <p className="mb-3 text-sm text-gray-400">Import this creator&apos;s strategies to your portfolio</p>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Open Marketplace →
          </Link>
        </div>
      </div>
      <SiteLegalFooter />
    </div>
  );
}
