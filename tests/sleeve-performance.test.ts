import { describe, it, expect } from "vitest";
import {
  computeLetterGrade,
  computePerformanceSummary,
  getConsistency,
  getISOWeekStart,
} from "@/lib/sleeve-performance/utils";

describe("getISOWeekStart", () => {
  it("returns the Monday of the week containing Wednesday 2026-07-01", () => {
    const wednesday = new Date("2026-07-01T12:00:00Z");
    expect(getISOWeekStart(wednesday)).toBe("2026-06-29");
  });

  it("handles Sunday by using the previous Monday", () => {
    const sunday = new Date("2026-07-05T12:00:00Z");
    expect(getISOWeekStart(sunday)).toBe("2026-06-29");
  });
});

describe("computeLetterGrade", () => {
  it("returns A for scores >= 80", () => {
    expect(computeLetterGrade(80)).toBe("A");
    expect(computeLetterGrade(95)).toBe("A");
  });

  it("returns F for scores < 35", () => {
    expect(computeLetterGrade(20)).toBe("F");
  });
});

describe("getConsistency", () => {
  it("returns new for < 4 weeks of history", () => {
    const history = [{ avg_drift_pct: 2 }, { avg_drift_pct: 3 }];
    expect(getConsistency(history)).toBe("new");
  });

  it("returns consistent for avg drift < 5%", () => {
    const history = Array.from({ length: 8 }, () => ({ avg_drift_pct: 3 }));
    expect(getConsistency(history)).toBe("consistent");
  });

  it("returns variable for avg drift >= 5%", () => {
    const history = Array.from({ length: 8 }, () => ({ avg_drift_pct: 8 }));
    expect(getConsistency(history)).toBe("variable");
  });
});

describe("computePerformanceSummary", () => {
  it("returns new consistency when no weeks", () => {
    expect(computePerformanceSummary([]).consistency).toBe("new");
  });
});
