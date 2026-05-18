import Link from "next/link";
import { LEGAL_LAST_UPDATED, LEGAL_ROUTES } from "@/lib/constants/compliance";

type LegalPageShellProps = {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  /** When true, show a high-visibility non-advisory callout under the title. */
  prominentNonAdvisory?: boolean;
};

export function LegalPageShell({
  eyebrow,
  title,
  children,
  prominentNonAdvisory = false,
}: LegalPageShellProps) {
  return (
    <div className="min-h-screen bg-[#0A1628] px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 text-xs uppercase tracking-widest text-emerald-400">{eyebrow}</p>
        <h1 className="mb-4 text-3xl font-light tracking-wide text-white sm:text-4xl">{title}</h1>
        <p className="mb-10 text-sm text-gray-500">Last updated: {LEGAL_LAST_UPDATED}</p>

        {prominentNonAdvisory ? (
          <div
            role="note"
            className="mb-10 rounded-lg border-2 border-amber-500/50 bg-amber-950/30 px-5 py-5"
          >
            <p className="text-center text-sm font-semibold uppercase tracking-wide text-amber-200">
              Not investment advice
            </p>
            <p className="mt-3 text-center text-base leading-relaxed text-amber-100/90">
              Pemabu does not offer investment advice. Nothing on this platform constitutes a recommendation to buy,
              sell, or hold any security, digital asset, or financial product. You are solely responsible for your
              decisions.
            </p>
            <p className="mt-4 text-center text-xs text-amber-200/70">
              <Link href={LEGAL_ROUTES.disclaimer} className="underline hover:text-amber-100">
                Read the full Investment Disclaimer
              </Link>
            </p>
          </div>
        ) : null}

        <article className="space-y-8 text-base leading-relaxed text-gray-400">{children}</article>
      </div>
    </div>
  );
}
