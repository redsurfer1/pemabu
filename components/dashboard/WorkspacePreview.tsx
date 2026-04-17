import PemabuLogo, { PemabuLogoCompact } from "@/components/brand/PemabuLogo";
import {
  ALLOCATION_RING,
  DASHBOARD_NAV_TABS,
} from "@/lib/dashboard/allocationData";

export default function WorkspacePreview() {
  return (
    <section
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "0 32px 64px",
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "#4a607a",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Workspace Preview
        </div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: "#f1f5f9",
            letterSpacing: "-0.01em",
            margin: 0,
            marginBottom: 8,
          }}
        >
          Designed for clarity
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#64748b",
            lineHeight: 1.7,
            margin: 0,
          }}
        >
          One workspace. All your portfolios. Every signal that matters.
        </p>
      </div>

      <div
        style={{
          border: "1px solid #1a2f4e",
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: "#0d1e36",
        }}
      >
        <div
          style={{
            padding: "14px 24px",
            borderBottom: "1px solid #1a2f4e",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#0a1628",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PemabuLogoCompact size={22} />
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#f1f5f9",
                letterSpacing: "0.06em",
              }}
            >
              PEMABU
            </span>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            {DASHBOARD_NAV_TABS.map((t) => {
              const isActive = t === "Dashboard";
              const isAdmin = t === "Admin";
              return (
                <span
                  key={t}
                  style={{
                    fontSize: 12,
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
                    cursor: "pointer",
                    letterSpacing: "0.01em",
                  }}
                >
                  {t}
                </span>
              );
            })}
          </div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              color: "#4a607a",
              letterSpacing: "0.1em",
            }}
          >
            LIVE · 14:32:07
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "280px 1fr",
            minHeight: 340,
          }}
        >
          <div
            style={{
              borderRight: "1px solid #1a2f4e",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
            }}
          >
            <PemabuLogo size={120} animate={true} />
            <div style={{ width: "100%" }}>
              {ALLOCATION_RING.map((a) => (
                <div
                  key={a.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 0",
                    borderBottom: "1px solid #111e30",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        backgroundColor: a.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      {a.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 11,
                      color: a.color,
                    }}
                  >
                    {a.pct}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: 24 }}>
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.14em",
                color: "#4a607a",
                textTransform: "uppercase",
                marginBottom: 20,
              }}
            >
              Portfolio · Blended Strategy Fund
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                marginBottom: 24,
              }}
            >
              {[
                { label: "Portfolio Value", val: "$2.4M", sub: "+1.4% MTD" },
                {
                  label: "Allocation Drift",
                  val: "1.8%",
                  sub: "within tolerance",
                },
                { label: "Next Rebalance", val: "3 days", sub: "scheduled" },
              ].map((card) => (
                <div
                  key={card.label}
                  style={{
                    padding: "14px 16px",
                    backgroundColor: "#0a1628",
                    border: "1px solid #1a2f4e",
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#4a607a",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    {card.label}
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 600,
                      color: "#f1f5f9",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {card.val}
                  </div>
                  <div
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 10,
                      color: "#10b981",
                      marginTop: 4,
                    }}
                  >
                    {card.sub}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "#4a607a",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Current vs. Target Allocation
              </div>
              <div
                style={{
                  display: "flex",
                  height: 6,
                  borderRadius: 3,
                  overflow: "hidden",
                  gap: 1,
                }}
              >
                {ALLOCATION_RING.map((a) => (
                  <div
                    key={a.label}
                    style={{
                      flex: parseInt(a.pct, 10),
                      backgroundColor: a.color,
                      opacity: 0.85,
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  height: 6,
                  borderRadius: 3,
                  overflow: "hidden",
                  gap: 1,
                  marginTop: 4,
                  opacity: 0.45,
                }}
              >
                {[36, 30, 22, 12].map((flex, i) => (
                  <div
                    key={i}
                    style={{
                      flex,
                      backgroundColor: ALLOCATION_RING[i].color,
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 9,
                    color: "#4a607a",
                  }}
                >
                  Current
                </span>
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 9,
                    color: "#4a607a",
                  }}
                >
                  Target
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
