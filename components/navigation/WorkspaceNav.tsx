"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  WORKSPACE_NAV_ITEMS,
  engineHref,
  isWorkspaceNavActive,
} from "@/lib/navigation/workspace-nav";

export type WorkspaceNavProps = {
  /** Preserves selected portfolio when linking to Engine */
  portfolioId?: string | null;
  className?: string;
};

export function WorkspaceNav({ portfolioId, className = "" }: WorkspaceNavProps) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className={`flex flex-wrap items-center gap-1 ${className}`.trim()}
      aria-label="Workspace"
    >
      {WORKSPACE_NAV_ITEMS.map((item) => {
        const href = item.label === "Engine" ? engineHref(portfolioId) : item.href;
        const active = isWorkspaceNavActive(pathname, item.pathPrefix);
        return (
          <Link
            key={item.href}
            href={href}
            className={`rounded border px-3 py-1 text-xs transition-colors ${
              active
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
