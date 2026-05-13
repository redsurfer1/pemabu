import { createClient } from "@/lib/supabase/server";
import { requireServiceAccess } from "@/lib/security/tier-guard";
import { OptionsOverlayClient } from "@/components/options/OptionsOverlayClient";

export default async function OptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ portfolio_id?: string }>;
}) {
  await requireServiceAccess("addon_options_overlay");
  const sp = await searchParams;
  let portfolioId = sp.portfolio_id?.trim() ?? "";
  if (!portfolioId) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      portfolioId = data?.id ?? "";
    }
  }

  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8 sm:px-8">
      <OptionsOverlayClient portfolioId={portfolioId} />
    </div>
  );
}
