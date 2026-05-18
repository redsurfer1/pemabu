import { describe, it, expect } from "vitest";
import {
  buildPortfolioMemoryEvents,
  formatEventDate,
  groupEventsByMonth,
  PORTFOLIO_MEMORY_NOTICE,
} from "@/lib/portfolio/portfolio-memory-events";

describe("portfolio memory timeline", () => {
  describe("groupEventsByMonth", () => {
    it("groups events correctly by month", () => {
      const events = buildPortfolioMemoryEvents({
        portfolio: {
          id: "p1",
          name: "Test",
          created_at: "2026-01-15T00:00:00Z",
        },
        holdings: [
          {
            id: "h1",
            ticker: "VTI",
            asset_class: "equity",
            created_at: "2026-02-10T00:00:00Z",
          },
        ],
      });
      const grouped = groupEventsByMonth(events);
      expect(grouped.size).toBeGreaterThanOrEqual(2);
    });

    it("handles empty event array", () => {
      expect(groupEventsByMonth([]).size).toBe(0);
    });
  });

  describe("formatEventDate", () => {
    it("formats a timestamp", () => {
      const formatted = formatEventDate("2026-07-01T00:00:00Z");
      expect(formatted).toContain("2026");
    });
  });

  describe("API contract", () => {
    it("includes non-advisory notice constant", () => {
      expect(PORTFOLIO_MEMORY_NOTICE.length).toBeGreaterThan(20);
      expect(PORTFOLIO_MEMORY_NOTICE.toLowerCase()).toContain("not");
    });
  });
});
