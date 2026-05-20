import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingPageClient } from "./OnboardingPageClient";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("onboarding_completed, onboarding_step_reached")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed) {
    redirect("/dashboard");
  }

  const initialStep = (profile?.onboarding_step_reached ?? 0) + 1;

  return <OnboardingPageClient initialStep={Math.min(initialStep, 3)} />;
}
