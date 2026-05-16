import { requireServiceAccess } from "@/lib/security/tier-guard";
import { GovernanceClient } from "@/components/governance/GovernanceClient";

export default async function GovernancePage() {
  await requireServiceAccess("addon_governance_alerts");
  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8 sm:px-8">
      <GovernanceClient />
    </div>
  );
}
