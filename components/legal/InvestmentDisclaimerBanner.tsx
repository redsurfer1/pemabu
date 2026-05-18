import Link from "next/link";
import { LEGAL_ROUTES, WORKSPACE_DISCLAIMER_BANNER } from "@/lib/constants/compliance";

export function InvestmentDisclaimerBanner() {
  return (
    <div
      role="note"
      aria-label="Investment disclaimer"
      className="border-b border-amber-500/30 bg-amber-950/25 px-4 py-2"
    >
      <p className="mx-auto max-w-6xl text-center text-[11px] leading-snug text-amber-100/90 sm:text-xs">
        <span className="font-semibold uppercase tracking-wide text-amber-200">Not investment advice.</span>{" "}
        {WORKSPACE_DISCLAIMER_BANNER}{" "}
        <Link
          href={LEGAL_ROUTES.disclaimer}
          className="whitespace-nowrap font-medium text-amber-300 underline underline-offset-2 hover:text-amber-100"
        >
          Full disclaimer
        </Link>
      </p>
    </div>
  );
}
