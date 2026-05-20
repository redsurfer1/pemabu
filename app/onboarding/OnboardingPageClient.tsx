"use client";

import { useRouter } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

interface OnboardingPageClientProps {
  initialStep: number;
}

export function OnboardingPageClient({ initialStep }: OnboardingPageClientProps) {
  const router = useRouter();

  return (
    <OnboardingWizard
      initialStep={initialStep}
      onComplete={() => router.push("/dashboard")}
    />
  );
}
