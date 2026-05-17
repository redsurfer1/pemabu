import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock refs (must use vi.hoisted — vi.mock is hoisted before imports) ─

const { mockUpdate, mockEq, mockScoreTicker } = vi.hoisted(() => {
  const mockEq = vi.fn().mockResolvedValue({ error: null });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
  const mockScoreTicker = vi.fn().mockResolvedValue({ composite_score: 75 });
  return { mockUpdate, mockEq, mockScoreTicker };
});

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({ update: mockUpdate }),
  },
}));

vi.mock("@/lib/token-quality/ttf-scorer", () => ({
  scoreTicker: mockScoreTicker,
}));

// ── Import under test (after mocks) ──────────────────────────────────────────

import { runSovereignScorePipeline } from "@/lib/portfolio/sovereign-score-pipeline";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runSovereignScorePipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockScoreTicker.mockResolvedValue({ composite_score: 75 });
  });

  it("calls scoreTicker for crypto holdings and writes score_token_quality", async () => {
    const holdings = [{ id: "h1", ticker: "BTC-USD", asset_class: "crypto" }];

    await runSovereignScorePipeline("portfolio-1", holdings);

    expect(mockScoreTicker).toHaveBeenCalledWith("BTC-USD");
    expect(mockUpdate).toHaveBeenCalledWith({ score_token_quality: 75 });
    expect(mockEq).toHaveBeenCalledWith("id", "h1");
  });

  it("does not call scoreTicker for equity holdings", async () => {
    const holdings = [{ id: "h2", ticker: "AAPL", asset_class: "equity" }];

    await runSovereignScorePipeline("portfolio-1", holdings);

    expect(mockScoreTicker).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does not crash if scoreTicker throws (non-fatal)", async () => {
    mockScoreTicker.mockRejectedValueOnce(new Error("CoinGecko timeout"));

    const holdings = [{ id: "h1", ticker: "ETH-USD", asset_class: "crypto" }];

    await expect(
      runSovereignScorePipeline("portfolio-1", holdings),
    ).resolves.not.toThrow();

    // Nothing should be written since score computation failed
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("scores crypto holdings but skips equity in a mixed list", async () => {
    const holdings = [
      { id: "h1", ticker: "BTC-USD", asset_class: "crypto" },
      { id: "h2", ticker: "AAPL", asset_class: "equity" },
      { id: "h3", ticker: "ETH-USD", asset_class: "crypto" },
    ];

    await runSovereignScorePipeline("portfolio-1", holdings);

    expect(mockScoreTicker).toHaveBeenCalledTimes(2);
    expect(mockScoreTicker).toHaveBeenCalledWith("BTC-USD");
    expect(mockScoreTicker).toHaveBeenCalledWith("ETH-USD");
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it("resolves immediately without throwing when holdings list is empty", async () => {
    await expect(
      runSovereignScorePipeline("portfolio-1", []),
    ).resolves.not.toThrow();

    expect(mockScoreTicker).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
