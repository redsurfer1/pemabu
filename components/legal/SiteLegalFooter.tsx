import Link from "next/link";
import { LEGAL_ROUTES } from "@/lib/constants/compliance";

type SiteLegalFooterProps = {
  className?: string;
};

const LINKS = [
  { href: LEGAL_ROUTES.disclaimer, label: "Investment Disclaimer" },
  { href: LEGAL_ROUTES.terms, label: "Terms of Service" },
  { href: LEGAL_ROUTES.privacy, label: "Privacy Policy" },
] as const;

export function SiteLegalFooter({ className = "" }: SiteLegalFooterProps) {
  return (
    <footer className={className}>
      <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2" aria-label="Legal">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-xs text-gray-500 underline-offset-2 hover:text-gray-300 hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-gray-600">
        © {new Date().getFullYear()} Pemabu. Private beta. Pemabu does not offer investment advice.
      </p>
    </footer>
  );
}
