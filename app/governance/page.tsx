import { requireServiceAccess } from "@/lib/security/tier-guard";
import { ComingSoonShell } from "@/components/shared/ComingSoonShell";

export default async function GovernancePage() {
  await requireServiceAccess("addon_governance_alerts");

  return (
    <div className="min-h-screen bg-[#0A1628]">
      <ComingSoonShell
        title="Governance Alert Layer"
        serviceKey="addon_governance_alerts"
        description="Monitor governance forums for tokens held in your portfolio. Plain-English proposal summaries surfaced as Watcher Agent signals — so you never miss a vote that affects your positions."
        plannedFeatures={[
          "Automatic monitoring of governance forums for held tokens",
          "Plain-English proposal summaries (no jargon)",
          "Surfaced as Watcher Agent signals alongside drift and RSI alerts",
          "Vote deadline alerts with estimated quorum status",
          "Governance history log per token",
        ]}
      />
    </div>
  );
}
