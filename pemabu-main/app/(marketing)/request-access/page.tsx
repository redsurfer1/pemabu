import Link from "next/link";

export default function RequestAccessPage() {
  return (
    <div className="min-h-screen bg-[#0A1628] px-6 py-24">
      <div className="mx-auto max-w-xl text-center">
        <p className="mb-6 text-xs uppercase tracking-widest text-emerald-400">Beta</p>
        <h1 className="mb-6 text-3xl font-light tracking-wide text-white">Request access</h1>
        <p className="mb-10 text-lg leading-relaxed text-gray-400">
          Pemabu is in private beta. Use Sign In on the home page if you already have an account, or reach out through
          your invitation channel to be added.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg border border-white/20 px-8 py-3 text-sm text-white transition-colors hover:border-white/40 hover:bg-white/5"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
