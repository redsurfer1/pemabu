import { requireServiceAccess } from "@/lib/security/tier-guard";
import { FamilySharingClient } from "@/components/family-sharing/FamilySharingClient";

export default async function FamilyPage() {
  await requireServiceAccess("addon_family_sharing");
  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8 sm:px-8">
      <FamilySharingClient />
    </div>
  );
}
