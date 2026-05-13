"use client";

interface ComingSoonShellProps {
  title: string;
  serviceKey: string;
  description: string;
  plannedFeatures: string[];
}

export function ComingSoonShell({
  title,
  serviceKey: _serviceKey,
  description,
  plannedFeatures,
}: ComingSoonShellProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="text-xs font-medium text-amber-400">Coming Soon</span>
        </div>
        <h1 className="text-2xl font-medium text-white">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">{description}</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <p className="mb-4 text-xs font-medium uppercase tracking-widest text-gray-500">Planned Features</p>
        <ul className="space-y-3">
          {plannedFeatures.map((feature, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
              <span className="mt-0.5 text-emerald-400">→</span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 rounded-lg border border-emerald-400/10 bg-emerald-400/5 px-4 py-3">
        <p className="text-xs text-emerald-400">
          ✓ Your subscription includes {title}. You will have access automatically when this module launches — no
          additional action required.
        </p>
      </div>

      <p className="mt-8 text-center text-[11px] text-gray-600">
        Not a registered investment advisor. For informational purposes only.
      </p>
    </div>
  );
}
