import { requireServiceAccess } from "@/lib/security/tier-guard";
import { CreatorDashboardClient } from "@/components/creator/CreatorDashboardClient";

export default async function CreatorDashboardPage() {
  await requireServiceAccess("addon_marketplace");
  return <CreatorDashboardClient />;
}
