"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isDemoMode, enableDemoMode, disableDemoMode } from "@/lib/demo/demo-mode";

interface DemoModeContextValue {
  active: boolean;
  enable: () => void;
  disable: () => void;
}

const DemoModeContext = createContext<DemoModeContextValue>({
  active: false,
  enable: () => {},
  disable: () => {},
});

export function useDemoMode() {
  return useContext(DemoModeContext);
}

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isDemoMode());
  }, []);

  const enable = () => {
    enableDemoMode();
    setActive(true);
  };

  const disable = () => {
    disableDemoMode();
    setActive(false);
  };

  return (
    <DemoModeContext.Provider value={{ active, enable, disable }}>
      {children}
    </DemoModeContext.Provider>
  );
}
