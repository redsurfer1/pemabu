import Link from "next/link";
import { LEGAL_ROUTES, NON_FIDUCIARY_FOOTER } from "@/lib/constants/compliance";

type PemabuDisclaimerProps = {
  className?: string;
  showFullDisclaimerLink?: boolean;
};

/** Compact disclaimer block for panels, modals, and workbook surfaces. */
export function PemabuDisclaimer({ className = "", showFullDisclaimerLink = true }: PemabuDisclaimerProps) {
  return (
    <p className={`text-[10px] leading-relaxed text-gray-500 ${className}`.trim()}>
      {NON_FIDUCIARY_FOOTER}
      {showFullDisclaimerLink ? (
        <>
          {" "}
          <Link href={LEGAL_ROUTES.disclaimer} className="text-gray-400 underline hover:text-gray-300">
            Investment Disclaimer
          </Link>
        </>
      ) : null}
    </p>
  );
}
