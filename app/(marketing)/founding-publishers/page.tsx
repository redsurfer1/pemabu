import Link from "next/link";
import MarketingNav from "@/components/home/MarketingNav";
import { SiteLegalFooter } from "@/components/legal/SiteLegalFooter";
import { FoundingPublisherSlotCounter } from "@/components/marketing/FoundingPublisherSlotCounter";
import { NON_FIDUCIARY_FOOTER } from "@/lib/constants/compliance";

export const metadata = {
  title: "Founding Publisher Program — Pemabu",
  description:
    "Join the first 50 publishers on Pemabu. Earn 80% royalties, get featured placement, and shape the future of the marketplace.",
};

export default function FoundingPublishersPage() {
  return (
    <div className="min-h-screen bg-[#0A1628] text-gray-200">
      <MarketingNav />
      <main className="mx-auto max-w-[900px] px-6 pb-16 pt-24">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">Founding Publisher Program</p>
        <h1 className="mt-3 font-serif text-4xl text-white">Be among the first 50.</h1>
        <p className="mt-4 text-lg text-gray-400 max-w-xl">
          Founding Publishers earn 80% of every import token sale. Featured in the marketplace. Permanent
          recognition.
        </p>

        <div className="mt-10 rounded-lg border border-white/10 bg-black/30 px-6 py-8">
          <FoundingPublisherSlotCounter />
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-black/20 p-5">
            <h2 className="text-sm font-semibold text-white">80/20 royalty split</h2>
            <p className="mt-2 text-sm text-gray-400">
              Standard publishers earn 70%. Founding Publishers earn 80%. On every $4.99 import token sale, you keep
              $3.99.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-5">
            <h2 className="text-sm font-semibold text-white">Featured placement</h2>
            <p className="mt-2 text-sm text-gray-400">
              Your strategies appear above non-founding publishers in marketplace search and leaderboard rankings.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-5">
            <h2 className="text-sm font-semibold text-white">Permanent recognition</h2>
            <p className="mt-2 text-sm text-gray-400">
              The ★ Founding Publisher badge stays with your strategies permanently, even after the program
              closes.
            </p>
          </div>
        </div>

        <section className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">How it works</h2>
          <ol className="mt-4 space-y-3 text-sm text-gray-300 list-decimal list-inside">
            <li>Publish a strategy from your portfolio (Intelligence tier required).</li>
            <li>Request Founding Publisher status via support or admin approval.</li>
            <li>Start earning 80% royalties when buyers import your blueprint.</li>
          </ol>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">FAQ</h2>
          <div>
            <p className="text-sm font-medium text-white">How long does the program last?</p>
            <p className="text-sm text-gray-400 mt-1">Until 50 slots are filled. No exceptions after that.</p>
          </div>
          <div>
            <p className="text-sm font-medium text-white">What happens to my 80% split after the program closes?</p>
            <p className="text-sm text-gray-400 mt-1">It stays. Founding Publisher status is permanent.</p>
          </div>
          <div>
            <p className="text-sm font-medium text-white">Is this investment advice?</p>
            <p className="text-sm text-gray-400 mt-1">
              No. All strategies are informational. Buyers see historical data only. {NON_FIDUCIARY_FOOTER}
            </p>
          </div>
        </section>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/request-access"
            className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Apply for Founding Publisher
          </Link>
          <Link
            href="/pricing"
            className="rounded-md border border-white/20 px-5 py-2.5 text-sm text-gray-200 hover:border-white/40"
          >
            Learn about the marketplace
          </Link>
        </div>
      </main>
      <SiteLegalFooter />
    </div>
  );
}
