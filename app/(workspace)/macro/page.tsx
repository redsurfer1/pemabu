import { requireServiceAccess } from "@/lib/security/tier-guard";
import { MacroIntelligenceClient } from "@/components/macro/MacroIntelligenceClient";

export default async function MacroPage() {
  await requireServiceAccess("addon_macro_intelligence");
  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8 sm:px-8">
      <MacroIntelligenceClient />
    </div>
  );
}
