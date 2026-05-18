import { Suspense } from "react";
import Link from "next/link";
import { requireWorkspaceUser } from "@/lib/navigation/workspace-auth";
import { createClient } from "@/lib/supabase/server";
import { PortfolioHistoryTimeline } from "@/components/portfolio/PortfolioHistoryTimeline";
import { PortfolioHistorySkeleton } from "@/components/portfolio/PortfolioHistorySkeleton";
import { NON_FIDUCIARY_FOOTER } from "@/lib/constants/compliance";
import { historyHref } from "@/lib/navigation/workspace-nav";

export const metadata = {
  title: "Portfolio History — Pemabu",
  description: "Your allocation story — a timeline of portfolio events and decisions.",
};

type PageProps = {
  searchParams: Promise<{ portfolioId?: string; portfolio?: string }>;
};

async function PortfolioSelector({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id, name")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (!portfolios?.length) {
    return (
      <p className="text-sm text-gray-500">
        Create a portfolio on the{" "}
        <Link href="/dashboard" className="text-sky-300 hover:underline">
          dashboard
        </Link>{" "}
        to view its history.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {portfolios.map((p) => (
        <li key={p.id}>
          <Link
            href={historyHref(p.id)}
            className="block rounded border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-200 hover:border-sky-500/30 hover:bg-sky-950/20"
          >
            {p.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function PortfolioHistoryPage({ searchParams }: PageProps) {
  const user = await requireWorkspaceUser();
  const sp = await searchParams;
  const portfolioId = sp.portfolioId?.trim() || sp.portfolio?.trim() || "";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-white">Your Allocation Story</h1>
        <p className="mt-1.5 text-sm text-gray-400">
          A chronological record of your portfolio events since you joined Pemabu. This is your
          history — not a prediction of the future.
        </p>
      </div>

      <div className="mb-6 rounded-md border border-white/10 bg-black/20 px-4 py-3">
        <p className="text-xs text-gray-500">{NON_FIDUCIARY_FOOTER}</p>
      </div>

      {portfolioId ? (
        <Suspense fallback={<PortfolioHistorySkeleton />}>
          <PortfolioHistoryTimeline portfolioId={portfolioId} />
        </Suspense>
      ) : (
        <PortfolioSelector userId={user.id} />
      )}
    </div>
  );
}
