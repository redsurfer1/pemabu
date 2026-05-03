"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { PemabuLogoCompact } from "@/components/brand/PemabuLogo";
import { DASHBOARD_NAV_TABS } from "@/lib/dashboard/allocationData";
import AllocationReference from "@/components/dashboard/AllocationReference";
import WorkspacePreview from "@/components/dashboard/WorkspacePreview";

interface DashboardPageProps {
  user: User;
}

export default function DashboardPage({ user }: DashboardPageProps) {
  const [activeTab, setActiveTab] = useState("Dashboard");

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0A1628",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          borderBottom: "1px solid #1a2f4e",
          backdropFilter: "blur(12px)",
          backgroundColor: "rgba(10,22,40,0.95)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 32px",
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <PemabuLogoCompact size={28} />
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: "#f1f5f9",
              }}
            >
              PEMABU
            </span>
          </div>

          <div style={{ display: "flex", gap: 28 }}>
            {DASHBOARD_NAV_TABS.map((t) => {
              const isActive = t === activeTab;
              const isAdmin = t === "Admin";
              return (
                <span
                  key={t}
                  onClick={() => setActiveTab(t)}
                  style={{
                    fontSize: 13,
                    color: isActive
                      ? "#10b981"
                      : isAdmin
                        ? "#2d3f54"
                        : "#4a607a",
                    fontWeight: isActive ? 500 : 400,
                    borderBottom: isActive
                      ? "1px solid #10b981"
                      : "1px solid transparent",
                    paddingBottom: 2,
                    cursor: isAdmin ? "not-allowed" : "pointer",
                    letterSpacing: "0.01em",
                    transition: "color 0.15s",
                  }}
                >
                  {t}
                </span>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                color: "#4a607a",
                letterSpacing: "0.1em",
              }}
            >
              LIVE
            </span>
            <span style={{ fontSize: 12, color: "#4a607a" }}>{user.email}</span>
            <button
              type="button"
              onClick={handleSignOut}
              style={{
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 400,
                color: "#64748b",
                backgroundColor: "transparent",
                border: "1px solid #1a2f4e",
                borderRadius: 5,
                cursor: "pointer",
                letterSpacing: "0.01em",
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main style={{ paddingTop: 60 }}>
        <section
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "48px 32px 0",
          }}
        >
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "#4a607a",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Portfolios
          </div>
          <p
            style={{
              fontSize: 14,
              color: "#64748b",
              margin: 0,
              maxWidth: 480,
              lineHeight: 1.6,
            }}
          >
            Portfolio cards will appear here in Phase 5 (owner-only, ≤20
            portfolios at beta).
          </p>
        </section>

        <AllocationReference />

        <WorkspacePreview />

        <section
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 32px 64px",
          }}
        >
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "#4a607a",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Signals
          </div>
          <p
            style={{
              fontSize: 14,
              color: "#64748b",
              margin: 0,
              maxWidth: 480,
              lineHeight: 1.6,
            }}
          >
            Signal feed placeholder — backend connection in Phase 4–5.
          </p>
        </section>
      </main>

      <footer
        style={{
          borderTop: "1px solid #1a2f4e",
          backgroundColor: "#0A1628",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: 12,
            color: "#2d3f54",
            letterSpacing: "0.04em",
            margin: 0,
          }}
        >
          © 2025 Pemabu&nbsp;&nbsp;·&nbsp;&nbsp;Private Beta&nbsp;&nbsp;·&nbsp;&nbsp;By
          invitation only
        </p>
      </footer>
    </div>
  );
}
