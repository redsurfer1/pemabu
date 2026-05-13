import { requireServiceAccess } from "@/lib/security/tier-guard";
import { ComingSoonShell } from "@/components/shared/ComingSoonShell";

export default async function FamilyPage() {
  await requireServiceAccess("addon_family_sharing");

  return (
    <div className="min-h-screen bg-[#0A1628]">
      <ComingSoonShell
        title="Family Sharing"
        serviceKey="addon_family_sharing"
        description="Share a simplified, read-only consolidated portfolio view with a spouse or partner. No execution access. No portfolio data leaves your local device — the view is broadcast via your existing Live Broadcast relay."
        plannedFeatures={[
          "Read-only simplified dashboard for spouse or partner",
          "Consolidated view across all portfolios (total value, drift status)",
          "No holding-level detail exposed — privacy preserved",
          "Delivered via Live Broadcast relay — no additional cloud infrastructure",
          "Revocable at any time from your local dashboard",
        ]}
      />
    </div>
  );
}
