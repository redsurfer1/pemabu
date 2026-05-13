import Link from "next/link";
import type { PemabuService } from "@/lib/types/database";

interface UpgradeGateProps {
  service: PemabuService;
  featureName: string;
  description: string;
}

export function UpgradeGate({ service, featureName, description }: UpgradeGateProps) {
  const suffix = service.pricing_model === "annual" ? "/year" : service.pricing_model === "one_time" ? " one-time" : "";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <svg className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>

        <div>
          <h2 className="text-xl font-medium text-white">{featureName}</h2>
          <p className="mt-2 text-sm text-gray-400">{description}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs text-gray-500">Catalog item</p>
          <p className="mt-1 text-3xl font-medium text-white">
            ${service.price_usd}
            <span className="text-sm font-normal text-gray-500">{suffix}</span>
          </p>
          {service.description ? <p className="mt-1 text-xs text-gray-500">{service.description}</p> : null}
        </div>

        <div className="space-y-3">
          <Link
            href="/pricing"
            className="block w-full rounded-lg bg-emerald-500 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-400"
          >
            View pricing — {featureName}
          </Link>
          <Link href="/dashboard" className="block text-sm text-gray-500 hover:text-white">
            Return to dashboard
          </Link>
        </div>

        <p className="text-[11px] text-gray-600">
          Not a registered investment advisor. For informational purposes only.
        </p>
      </div>
    </div>
  );
}
