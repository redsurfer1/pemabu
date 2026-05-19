"use client";

import { type ReactNode } from "react";
import { DemoModeProvider } from "@/components/demo/DemoModeProvider";
import { DemoBanner } from "@/components/demo/DemoBanner";

export function DemoModeWrapper({ children }: { children: ReactNode }) {
  return (
    <DemoModeProvider>
      <DemoBanner />
      {children}
    </DemoModeProvider>
  );
}
