import type { PositionSentiment } from "@/lib/intelligence/position-sentiment";

const SENTIMENT_META: Record<PositionSentiment, { label: string; className: string }> = {
  accumulating: {
    label: "Accumulating",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  holding: {
    label: "Holding",
    className: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  decreasing: {
    label: "Decreasing",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  no_position: {
    label: "No position",
    className: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  },
};

export function PositionSentimentBadge({ sentiment }: { sentiment: PositionSentiment }) {
  const meta = SENTIMENT_META[sentiment];
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

export function PositionSentimentSummary({
  counts,
}: {
  counts: Record<PositionSentiment, number>;
}) {
  const entries = (Object.keys(SENTIMENT_META) as PositionSentiment[]).filter((k) => counts[k] > 0);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map((key) => (
        <span key={key} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <PositionSentimentBadge sentiment={key} />
          <span className="text-gray-400">
            {counts[key]} trade{counts[key] === 1 ? "" : "s"}
          </span>
        </span>
      ))}
    </div>
  );
}
