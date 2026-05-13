import { requireServiceAccess } from "@/lib/security/tier-guard";
import { ComingSoonShell } from "@/components/shared/ComingSoonShell";

export default async function MacroPage() {
  await requireServiceAccess("addon_macro_intelligence");

  return (
    <div className="min-h-screen bg-[#0A1628]">
      <ComingSoonShell
        title="Macro Intelligence"
        serviceKey="addon_macro_intelligence"
        description="Weekly macro regime classification, regime-adjusted assumption suggestions, and cross-asset correlation heatmap. Know what environment your portfolio is operating in."
        plannedFeatures={[
          "Weekly macro regime classification (risk-on / risk-off / stagflation / deflation)",
          "Regime-adjusted weighting suggestions for Assumptions tab",
          "Cross-asset correlation heatmap (equity / fixed income / crypto / commodities)",
          "Regime history log with portfolio performance overlay",
        ]}
      />
    </div>
  );
}
