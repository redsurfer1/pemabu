import { requireServiceAccess } from "@/lib/security/tier-guard";
import { isDemoRequest } from "@/lib/demo/demo-guard";
import { VaultExportClient } from "@/components/vault-export/VaultExportClient";

export default async function VaultExportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const demo = isDemoRequest(sp);
  if (!demo) await requireServiceAccess("addon_data_vault_export");

  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8 sm:px-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Vault Export</h1>
          <p className="mt-1 text-sm text-gray-400">
            Automated weekly encrypted backup of your Pemabu data to your own cloud storage.
          </p>
        </div>
        <VaultExportClient demo={demo} />
      </div>
    </div>
  );
}
