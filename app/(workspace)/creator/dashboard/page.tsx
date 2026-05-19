import { requireMinimumTier } from "@/lib/security/tier-guard";
import { CreatorDashboardClient } from "@/components/creator/CreatorDashboardClient";
import { DataFetchBoundary } from "@/components/shared/DataFetchBoundary";

export default async function CreatorDashboardPage() {
  await requireMinimumTier("INTELLIGENCE");
  return (
    <DataFetchBoundary title="Creator dashboard unavailable">
      <CreatorDashboardClient />
    </DataFetchBoundary>
  );
}
