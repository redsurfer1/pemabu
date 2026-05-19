"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pemabu.onboarding.completed";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

export function useOnboardingTour(steps: TourStep[]) {
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(true);

  useEffect(() => {
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      setCompleted(val === "true");
    } catch {
      setCompleted(true);
    }
  }, []);

  const start = useCallback(() => {
    setActive(true);
    setCurrentStep(0);
  }, []);

  const next = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      finish();
    }
  }, [currentStep, steps.length]);

  const prev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    setCompleted(true);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* private mode */
    }
  }, []);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  return {
    active,
    currentStep,
    current: steps[currentStep] ?? null,
    total: steps.length,
    completed,
    start,
    next,
    prev,
    skip,
    finish,
    isLast: currentStep === steps.length - 1,
    isFirst: currentStep === 0,
  };
}
