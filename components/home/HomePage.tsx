"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import PemabuLogo from "@/components/brand/PemabuLogo";
import AuthModal from "@/components/AuthModal";
import MarketingNav from "@/components/home/MarketingNav";
import { SiteLegalFooter } from "@/components/legal/SiteLegalFooter";
import type { LeaderboardPreviewItem } from "@/components/home/leaderboard-preview";
import { AllocationRing } from "@/components/allocation/AllocationRing";
import { PUBLIC_DEMO_ALLOCATION, PUBLIC_DEMO_TOTAL_VALUE } from "@/lib/demo/public-demo-data";

interface HomePageProps {
  leaderboardPreview?: LeaderboardPreviewItem[];
}

export default function HomePage({ leaderboardPreview = [] }: HomePageProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      setAuthLoading(false);
      if (u) window.location.assign("/dashboard");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        setShowAuth(false);
        window.location.assign("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#0A1628",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <PemabuLogo size={48} animate={true} />
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0A1628",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      <MarketingNav onSignIn={() => setShowAuth(true)} />

      <section
        style={{
          paddingTop: 160,
          paddingBottom: 100,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "#10b981",
            textTransform: "uppercase",
            marginBottom: 40,
          }}
        >
          Allocation Intelligence
        </div>

        <PemabuLogo size={160} animate={true} />

        <div style={{ marginTop: 40, textAlign: "center" }}>
          <h1
            style={{
              fontSize: 52,
              fontWeight: 300,
              letterSpacing: "0.18em",
              color: "#f1f5f9",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            PEMABU
          </h1>
          <p
            style={{
              marginTop: 20,
              fontSize: 16,
              fontWeight: 400,
              color: "#64748b",
              letterSpacing: "0.01em",
              lineHeight: 1.75,
              maxWidth: 480,
            }}
          >
            Your portfolio, monitored in real time.
            <br />
            Allocation drift detection and scenario analysis
            <br />
            for investors who want to stay ahead.
          </p>
        </div>

        <div
          style={{
            marginTop: 48,
            display: "flex",
            gap: 12,
          }}
        >
          <Link
            href="/request-access"
            style={{
              padding: "11px 28px",
              fontSize: 13,
              fontWeight: 500,
              color: "#0A1628",
              backgroundColor: "#10b981",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              letterSpacing: "0.02em",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Request Access
          </Link>
          <Link
            href="/demo"
            className="inline-block rounded-md border border-emerald-500/40 px-8 py-3 text-[13px] font-medium tracking-wide text-emerald-400 transition-colors hover:bg-emerald-500/10"
          >
            Try Interactive Demo
          </Link>
          <Link
            href="/about"
            className="inline-block rounded-md border border-[#1a2f4e] px-8 py-3 text-[13px] font-medium tracking-wide text-slate-400 transition-colors hover:border-white/40 hover:bg-white/5 hover:text-slate-200"
          >
            See How It Works
          </Link>
        </div>

        <div
          style={{
            marginTop: 56,
            padding: "28px 24px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            backgroundColor: "rgba(255,255,255,0.02)",
            maxWidth: 420,
            width: "100%",
          }}
        >
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.16em",
              color: "#64748b",
              textTransform: "uppercase",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            Allocation ring preview
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <AllocationRing allocation={PUBLIC_DEMO_ALLOCATION} size={180} interactive />
          </div>
          <p style={{ marginTop: 12, textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
            Sample portfolio · USD {PUBLIC_DEMO_TOTAL_VALUE.toLocaleString()}
          </p>
          <p style={{ marginTop: 8, textAlign: "center", fontSize: 11, color: "#64748b" }}>
            Dashed ring = targets · solid segments = actual weights
          </p>
        </div>
      </section>

      {leaderboardPreview.length > 0 ? (
        <section
          style={{
            maxWidth: 560,
            margin: "0 auto 48px",
            padding: "24px 20px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            backgroundColor: "rgba(255,255,255,0.02)",
          }}
        >
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              color: "#10b981",
              textTransform: "uppercase",
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            Marketplace activity
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {leaderboardPreview.map((row) => (
              <li
                key={row.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  fontSize: 13,
                  color: "#cbd5e1",
                }}
              >
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{row.pseudonym}</span>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  grade {row.strategy_grade.toFixed(2)} · {row.subscriber_count} subs
                </span>
              </li>
            ))}
          </ul>
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Link
              href="/marketplace"
              style={{ fontSize: 12, color: "#34d399", textDecoration: "none", letterSpacing: "0.04em" }}
            >
              View full leaderboard →
            </Link>
          </div>
        </section>
      ) : null}

      <footer
        id="site-footer"
        style={{
          borderTop: "1px solid #1a2f4e",
          backgroundColor: "#0A1628",
          padding: "32px 24px",
          marginTop: "auto",
        }}
      >
        <SiteLegalFooter />
      </footer>
    </div>
  );
}
