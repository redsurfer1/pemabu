import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET — check if user needs to see the wizard
export const GET = withAuth(async (_req, user) => {
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("onboarding_completed, onboarding_step_reached")
    .eq("id", user.id)
    .single();

  if (error) throw error;

  // Also check if user has any portfolios — if yes, skip wizard regardless of flag
  const { count } = await supabaseAdmin
    .from("portfolios")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const hasPortfolios = (count ?? 0) > 0;

  return NextResponse.json({
    completed: data?.onboarding_completed ?? false,
    stepReached: data?.onboarding_step_reached ?? 0,
    hasPortfolios,
    // Show wizard only when not completed AND no portfolios exist
    showWizard: !(data?.onboarding_completed) && !hasPortfolios,
  });
});
