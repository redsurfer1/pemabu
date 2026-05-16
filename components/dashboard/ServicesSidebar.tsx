"use client";

import Link from "next/link";
import { PEMABU_SERVICES } from "@/lib/constants/services";
import {
  DASHBOARD_SERVICE_GROUPS,
  SERVICE_CATEGORY_LABELS,
  serviceHref,
  servicePriceLabel,
} from "@/lib/dashboard/service-links";

const QUICK_LINKS = [
  { label: "All pricing", href: "/pricing" },
  { label: "Start trial", href: "/trial" },
  { label: "Marketplace", href: "/marketplace" },
] as const;

export function ServicesSidebar() {
  const byCategory = DASHBOARD_SERVICE_GROUPS.map((cat) => ({
    category: cat,
    label: SERVICE_CATEGORY_LABELS[cat] ?? cat,
    items: PEMABU_SERVICES.filter((s) => s.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="flex h-full max-h-[calc(100vh-8rem)] w-[200px] shrink-0 flex-col rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="shrink-0 border-b border-white/10 px-3 py-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">Pemabu services</h2>
        <p className="mt-1 text-[10px] leading-snug text-gray-600">Open a product or upgrade from pricing.</p>
        <ul className="mt-2 space-y-1">
          {QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block rounded px-2 py-1 text-[11px] text-emerald-400/90 transition-colors hover:bg-white/5 hover:text-emerald-300"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {byCategory.map((group) => (
          <div key={group.category} className="mb-3 last:mb-0">
            <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-gray-600">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((svc) => (
                <li key={svc.service_key}>
                  <Link
                    href={serviceHref(svc.service_key)}
                    className="group block rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-white/10 hover:bg-white/5"
                    title={svc.description}
                  >
                    <span className="block text-[11px] font-medium leading-tight text-gray-200 group-hover:text-white">
                      {svc.display_name}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-gray-500">
                      {servicePriceLabel(svc.service_key)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
