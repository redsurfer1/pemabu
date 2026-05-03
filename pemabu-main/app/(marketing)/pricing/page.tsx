import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0A1628] px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-6 text-xs uppercase tracking-widest text-emerald-400">Pricing</p>
        <h1 className="mb-6 text-4xl font-light tracking-wide text-white">Free during beta.</h1>
        <p className="mb-16 text-lg leading-relaxed text-gray-400">
          Pemabu is currently free for all beta participants. Pricing will be announced before public launch.
        </p>

        <div className="mb-12 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-10">
          <p className="mb-4 text-xs uppercase tracking-widest text-emerald-400">Beta access</p>
          <p className="mb-2 text-5xl font-light text-white">$0</p>
          <p className="mb-8 text-sm text-gray-500">During private beta</p>
          <ul className="mx-auto mb-8 max-w-xs space-y-3 text-left">
            {[
              "Portfolio monitoring",
              "Allocation drift detection",
              "Nightly price refresh",
              "Weekly AI brief",
              "Signal history",
              "Admin dashboard",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-gray-300">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                {feature}
              </li>
            ))}
          </ul>
          <Link
            href="/request-access"
            className="inline-block rounded-lg bg-emerald-500 px-8 py-3 text-sm text-white transition-colors hover:bg-emerald-400"
          >
            Request beta access
          </Link>
        </div>

        <p className="text-xs text-gray-600">Spots are limited. Beta access is by invitation only.</p>
      </div>
    </div>
  );
}
