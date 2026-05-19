import { getCachedServices } from "@/lib/cache/service-catalog";
import { requireWorkspaceUser } from "@/lib/navigation/workspace-auth";
import { SubscriptionManager } from "@/components/subscriptions/SubscriptionManager";

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; success?: string; cancelled?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireWorkspaceUser();
  const services = await getCachedServices();

  if (sp.success === "1" && sp.service) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-white">Subscription active</h2>
          <p className="text-sm text-gray-400">Your {sp.service} subscription is now active.</p>
          <a href="/dashboard" className="inline-block rounded bg-emerald-500 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-400">
            Return to dashboard
          </a>
        </div>
      </div>
    );
  }

  if (sp.cancelled === "1") {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <h2 className="text-xl font-medium text-white">Checkout cancelled</h2>
          <p className="text-sm text-gray-400">No changes were made to your subscription.</p>
          <a href="/upgrade" className="inline-block rounded bg-emerald-500 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-400">
            Try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1628]">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-white mb-8">Subscription Management</h1>
        <SubscriptionManager
          userId={user.id}
          userEmail={user.email ?? ""}
          services={services}
        />
      </div>
    </div>
  );
}
