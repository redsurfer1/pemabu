"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import MarketingNav from "@/components/home/MarketingNav";
import AuthModal from "@/components/AuthModal";
import { SiteLegalFooter } from "@/components/legal/SiteLegalFooter";

/** Shared chrome for `app/(marketing)/*` — single nav + legal footer. */
export function MarketingLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showAuth, setShowAuth] = useState(false);
  const openAuthOnSignIn = pathname === "/demo";

  return (
    <>
      {showAuth && openAuthOnSignIn ? <AuthModal onClose={() => setShowAuth(false)} /> : null}
      <MarketingNav onSignIn={openAuthOnSignIn ? () => setShowAuth(true) : undefined} />
      <div className="flex min-h-screen flex-col bg-[#0A1628] pt-[60px]">
        <div className="flex-1">{children}</div>
        <SiteLegalFooter className="border-t border-[#1a2f4e] px-6 py-8" />
      </div>
    </>
  );
}
