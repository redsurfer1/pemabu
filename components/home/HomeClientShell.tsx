"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import AuthModal from "@/components/AuthModal";
import MarketingNav from "@/components/home/MarketingNav";

export function HomeClientShell() {
  const [showAuth, setShowAuth] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      if (u) {
        window.location.assign("/dashboard");
        return;
      }
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setShowAuth(false);
        window.location.assign("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <MarketingNav onSignIn={authReady ? () => setShowAuth(true) : undefined} />
    </>
  );
}
