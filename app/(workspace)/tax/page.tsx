import { requireServiceAccess } from "@/lib/security/tier-guard";
import { TaxExportClient } from "@/components/tax/TaxExportClient";

export const metadata = {
  title: "Tax Export | Pemabu",
};

export default async function TaxPage() {
  await requireServiceAccess("autonomous_annual");

  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8 sm:px-8">
      <TaxExportClient />
    </div>
  );
}
