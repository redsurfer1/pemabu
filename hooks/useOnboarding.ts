"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface OnboardingStatus {
  completed: boolean;
  stepReached: number;
  hasPortfolios: boolean;
  showWizard: boolean;
}

async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  const res = await fetch("/api/onboarding/status", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to fetch onboarding status");
  return res.json() as Promise<OnboardingStatus>;
}

async function updateOnboarding(payload: {
  stepReached: number;
  completed: boolean;
}): Promise<void> {
  await fetch("/api/onboarding/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
}

export function useOnboarding() {
  const qc = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ["onboarding", "status"],
    queryFn: fetchOnboardingStatus,
    staleTime: 5 * 60 * 1000,
  });

  const { mutate: markStep } = useMutation({
    mutationFn: (step: number) =>
      updateOnboarding({ stepReached: step, completed: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });

  const { mutate: completeWizard } = useMutation({
    mutationFn: (step: number) =>
      updateOnboarding({ stepReached: step, completed: true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["onboarding"] });
      void qc.invalidateQueries({ queryKey: ["portfolios"] });
    },
  });

  const { mutate: dismissWizard } = useMutation({
    mutationFn: () =>
      updateOnboarding({ stepReached: data?.stepReached ?? 0, completed: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });

  return {
    showWizard: data?.showWizard ?? false,
    stepReached: data?.stepReached ?? 0,
    hasPortfolios: data?.hasPortfolios ?? false,
    isPending,
    markStep,
    completeWizard,
    dismissWizard,
  };
}
