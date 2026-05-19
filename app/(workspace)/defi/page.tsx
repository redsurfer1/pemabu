import { requireServiceAccess } from "@/lib/security/tier-guard";
import { isDemoRequest } from "@/lib/demo/demo-guard";
import { DefiClient } from "@/components/defi/DefiClient";

export default async function DefiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const demo = isDemoRequest(sp);
  if (!demo) await requireServiceAccess("addon_defi_onchain");
  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8 sm:px-8">
      <DefiClient demo={demo} />
    </div>
  );
}
