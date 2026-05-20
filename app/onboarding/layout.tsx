import type { ReactNode } from "react";

export const metadata = {
  title: "Getting Started — Pemabu",
  description: "Set up your first portfolio",
};

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A1628]">
      {children}
    </main>
  );
}
