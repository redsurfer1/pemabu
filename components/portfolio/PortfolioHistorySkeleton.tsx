export function PortfolioHistorySkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-md border border-white/10 bg-white/5 h-16" />
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, monthIndex) => (
        <div key={monthIndex} className="space-y-2">
          <div className="h-3 w-24 bg-white/10 rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="pl-10 relative">
              <div className="absolute left-1.5 top-1.5 w-5 h-5 rounded-full bg-white/10" />
              <div className="rounded-md border border-white/10 bg-white/5 h-14" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
