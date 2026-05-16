"use client";

import { useEffect, useState } from "react";
import { DashboardServicesProvider } from "@/components/dashboard/DashboardServicesContext";
import {
  SERVICES_SIDEBAR_STORAGE_KEY,
  WorkspaceChrome,
} from "@/components/navigation/WorkspaceChrome";

export function DashboardPageShell({
  userId,
  userEmail,
  children,
}: {
  userId: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  const [servicesOpen, setServicesOpen] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SERVICES_SIDEBAR_STORAGE_KEY);
      if (stored !== null) setServicesOpen(stored === "true");
    } catch {
      /* private mode */
    }
  }, []);

  const toggleServicesSidebar = () => {
    setServicesOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SERVICES_SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <WorkspaceChrome
      userId={userId}
      userEmail={userEmail}
      servicesToggle
      servicesOpen={servicesOpen}
      onServicesToggle={toggleServicesSidebar}
    >
      <DashboardServicesProvider servicesOpen={servicesOpen}>{children}</DashboardServicesProvider>
    </WorkspaceChrome>
  );
}
