import { ALLOCATION_RING } from "@/lib/dashboard/allocationData";

export default function AllocationReference() {
  return (
    <section
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "64px 32px 48px",
      }}
    >
      <div style={{ marginBottom: 36 }}>
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
          Ring Allocation Reference
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
          Each ring segment is a live asset class
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#64748b",
            lineHeight: 1.7,
            maxWidth: 560,
            margin: 0,
          }}
        >
          The ring responds in real time as allocation drift and rebalancing
          events occur across your portfolios.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 2,
        }}
      >
        {ALLOCATION_RING.map((a) => (
          <div
            key={a.label}
            style={{
              padding: "28px 24px",
              backgroundColor: a.bg,
              border: `1px solid ${a.border}`,
              borderRadius: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: a.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 20,
                  fontWeight: 500,
                  color: a.color,
                  letterSpacing: "-0.02em",
                }}
              >
                {a.pct}
              </span>
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#f1f5f9",
                letterSpacing: "0.02em",
                marginBottom: 6,
              }}
            >
              {a.label}
            </div>
            <div style={{ fontSize: 12, color: "#4a607a", lineHeight: 1.5 }}>
              {a.desc}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
