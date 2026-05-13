import { redirect } from "next/navigation";
import { getCachedServices } from "@/lib/cache/service-catalog";
import { UpgradeGate } from "@/components/shared/UpgradeGate";

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const sp = await searchParams;
  const serviceKey = sp.service;
  if (!serviceKey) redirect("/dashboard");

  const services = await getCachedServices();
  const service = services.find((s) => s.service_key === serviceKey);

  if (!service) redirect("/pricing");

  return (
    <div className="min-h-screen bg-[#0A1628]">
      <UpgradeGate
        service={service}
        featureName={service.display_name}
        description={service.description ?? "Upgrade to access this feature."}
      />
    </div>
  );
}
