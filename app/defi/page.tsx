import { requireServiceAccess } from "@/lib/security/tier-guard";
import { DefiClient } from "@/components/defi/DefiClient";

export default async function DefiPage() {
  await requireServiceAccess("addon_defi_onchain");
  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8 sm:px-8">
      <DefiClient />
    </div>
  );
}
