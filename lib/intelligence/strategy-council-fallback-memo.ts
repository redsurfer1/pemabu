import type { StrategyCouncilMemoPayload } from "@/lib/services/ai";
import type { InstitutionalMemoryV1 } from "@/lib/intelligence/strategy-council";

/** Deterministic memo when Claude is unavailable (no API key or upstream error). */
export function buildFallbackStrategyCouncilMemo(packet: InstitutionalMemoryV1): StrategyCouncilMemoPayload {
  const exec = packet.execution;
  const perf = packet.performance;
  const driftLines =
    packet.driftBySleeve.length === 0
      ? "No sleeve drift alerts were recorded in this window."
      : packet.driftBySleeve
          .map(
            (s) =>
              `- ${s.sleeveKey}: ${s.alertCount} alert(s), max drift ${s.maxDriftPct}%, avg ${s.avgDriftPct}%`,
          )
          .join("\n");

  const executive = [
    `Portfolio window: ${packet.windowStartUtc.slice(0, 10)} → ${packet.windowEndUtc.slice(0, 10)}.`,
    `Current NAV (USD): ${perf.navUsdCurrent}.`,
    perf.navChangePct != null
      ? `Estimated NAV change over the window: ${perf.navChangePct}%.`
      : "NAV change over the window could not be computed from available snapshots.",
    `Value-weighted RSI: ${perf.valueWeightedRsiCurrent ?? "n/a"}${
      perf.rsiChangePts != null ? ` (Δ ${perf.rsiChangePts} pts vs window reference)` : ""
    }.`,
  ].join("\n\n");

  const discipline = [
    `Autonomous execution outcomes: ${exec.successCount} success, ${exec.failureCount} failure.`,
    Object.keys(exec.byVenue).length
      ? `By venue:\n${Object.entries(exec.byVenue)
          .map(([v, c]) => `  - ${v}: ${c.success} ok / ${c.failure} fail`)
          .join("\n")}`
      : "No venue-tagged execution events in this window.",
    `\nDrift summary:\n${driftLines}`,
  ].join("\n\n");

  const gaps =
    packet.dataGaps.length > 0
      ? `\n\nData gaps noted: ${packet.dataGaps.join(", ")}.`
      : "";

  const macro = [
    "Macro-tilt suggestions are limited to observable drift and execution aggregates in this packet.",
    "Consider reviewing sleeves with elevated drift counts before adjusting target weights.",
    "No personalized legal, tax, or investment advice is implied.",
    gaps.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  const sections = [
    { id: "executive", heading: "Executive Summary", bodyMarkdown: executive },
    { id: "discipline", heading: "Discipline Report", bodyMarkdown: discipline },
    { id: "macro", heading: "Macro-Tilt Suggestions", bodyMarkdown: macro },
  ] as const;

  const fullMarkdown = sections.map((s) => `## ${s.heading}\n\n${s.bodyMarkdown}`).join("\n\n");

  return {
    markdown: fullMarkdown,
    pdfLayout: {
      documentTitle: "Strategy Council — Monthly Memo",
      sections: [...sections],
    },
  };
}
