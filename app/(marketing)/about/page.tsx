import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0A1628] px-6 py-24">
      <div className="mx-auto max-w-2xl">
        <p className="mb-6 text-xs uppercase tracking-widest text-emerald-400">About</p>
        <h1 className="mb-10 text-4xl font-light tracking-wide text-white">
          Built for investors who think in allocations.
        </h1>
        <div className="space-y-6 text-lg leading-relaxed text-gray-400">
          <p>
            Pemabu is a portfolio monitoring and allocation intelligence platform. It watches your holdings, detects
            drift from your target allocation, and surfaces signals before small deviations become large problems.
          </p>
          <p>
            The allocation ring at the center of Pemabu is not decorative. Each segment represents a live asset class
            in your portfolio — equity, fixed income, alternatives, and cash. As prices move and weights shift, the
            ring responds. Drift beyond your configured threshold generates a signal automatically.
          </p>
          <p>
            Currently in private beta. Access is by invitation only. Built with precision for sophisticated individual
            investors who manage their own wealth and want better tools to stay ahead of their allocation.
          </p>
        </div>
        <div className="mt-12 border-t border-white/10 pt-12">
          <p className="mb-6 text-sm uppercase tracking-widest text-gray-600">What Pemabu monitors</p>
          <div className="grid grid-cols-2 gap-6">
            {[
              {
                label: "Allocation drift",
                desc: "When actual weights deviate from targets beyond your threshold",
              },
              {
                label: "Price trends",
                desc: "Holdings moving significantly vs their asset class benchmark",
              },
              {
                label: "Weekly brief",
                desc: "AI-generated narrative summarizing your portfolio each week",
              },
              {
                label: "Snapshot history",
                desc: "Point-in-time allocation records for review and compliance",
              },
              {
                label: "Crypto allocation",
                desc: "Bitcoin, Ethereum, altcoins, and DeFi positions tracked against your digital asset sleeve target",
              },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 p-4">
                <p className="mb-2 text-sm font-medium text-white">{item.label}</p>
                <p className="text-xs leading-relaxed text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12">
          <Link
            href="/request-access"
            className="inline-block rounded-lg bg-emerald-500 px-8 py-3 text-sm text-white transition-colors hover:bg-emerald-400"
          >
            Request beta access
          </Link>
        </div>
      </div>
    </div>
  );
}
