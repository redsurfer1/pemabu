"use client";

import Link from "next/link";
import { PemabuLogoCompact } from "@/components/brand/PemabuLogo";

export type MarketingNavProps = {
  /** When set (e.g. on homepage), Sign In opens the auth modal instead of navigating home. */
  onSignIn?: () => void;
};

export default function MarketingNav({ onSignIn }: MarketingNavProps) {
  return (
    <nav
      className="fixed left-0 right-0 top-0 z-50 border-b border-[#1a2f4e] backdrop-blur-md"
      style={{ backgroundColor: "rgba(10,22,40,0.85)" }}
    >
      <div className="mx-auto flex h-[60px] max-w-[1200px] items-center justify-between px-8">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <PemabuLogoCompact size={30} />
          <span className="text-[15px] font-semibold tracking-wide text-slate-100">PEMABU</span>
        </Link>

        <div className="flex items-center gap-7">
          <Link
            href="/about"
            className="cursor-pointer text-[13px] font-normal tracking-wide text-slate-500 no-underline hover:text-slate-300"
          >
            About
          </Link>
          <Link
            href="/crypto"
            className="cursor-pointer text-[13px] font-normal tracking-wide text-slate-500 no-underline hover:text-slate-300"
          >
            Crypto
          </Link>
          <Link
            href="/pricing"
            className="cursor-pointer text-[13px] font-normal tracking-wide text-slate-500 no-underline hover:text-slate-300"
          >
            Pricing
          </Link>
          <Link
            href="/request-access"
            className="cursor-pointer text-[13px] font-medium tracking-wide text-emerald-500 no-underline hover:text-emerald-400"
          >
            Request Access
          </Link>
          {onSignIn ? (
            <button
              type="button"
              onClick={onSignIn}
              className="cursor-pointer rounded-md border border-[#254268] bg-transparent px-[18px] py-[7px] text-[13px] font-medium tracking-wide text-slate-100 hover:border-[#335a8a]"
            >
              Sign In
            </button>
          ) : (
            <Link
              href="/"
              className="cursor-pointer rounded-md border border-[#254268] bg-transparent px-[18px] py-[7px] text-[13px] font-medium tracking-wide text-slate-100 no-underline hover:border-[#335a8a]"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
