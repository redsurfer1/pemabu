"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { label: "Users", href: "/admin" },
  { label: "Portfolios", href: "/admin/portfolios" },
  { label: "Pricing", href: "/admin/pricing" },
  { label: "Subscriptions", href: "/admin/subscriptions" },
  { label: "Ops", href: "/admin/ops" },
];

export function AdminNav() {
  const pathname = usePathname();

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.assign("/");
  }

  return (
    <nav className="flex items-center justify-between border-b border-white/10 px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="text-sm font-semibold tracking-widest text-white">
          PEMABU
          <span className="ml-2 text-xs font-normal tracking-normal text-amber-400">admin</span>
        </span>
        <div className="flex gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                pathname === item.href ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="text-xs text-gray-500 transition-colors hover:text-gray-300">
          ← Back to dashboard
        </Link>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="text-xs text-gray-500 transition-colors hover:text-white"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
