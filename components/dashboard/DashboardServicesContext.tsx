"use client";

import { createContext, useContext } from "react";

type DashboardServicesContextValue = {
  servicesOpen: boolean;
};

const DashboardServicesContext = createContext<DashboardServicesContextValue>({
  servicesOpen: true,
});

export function DashboardServicesProvider({
  servicesOpen,
  children,
}: {
  servicesOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <DashboardServicesContext.Provider value={{ servicesOpen }}>
      {children}
    </DashboardServicesContext.Provider>
  );
}

export function useDashboardServices() {
  return useContext(DashboardServicesContext);
}
