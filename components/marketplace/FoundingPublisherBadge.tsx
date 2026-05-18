export function FoundingPublisherBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-300 ${className}`.trim()}
      title="Founding Publisher — first 50 publishers on Pemabu"
    >
      <span aria-hidden="true">★</span>
      Founding Publisher
    </span>
  );
}
