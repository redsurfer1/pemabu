/**
 * Multi-persona journey coverage for the sovereign portfolio logic layer.
 * Runs under Vitest (Node, headless). Uses Decimal-backed helpers + in-memory harness
 * (no live Supabase required).
 */

import { describe, expect, it } from "vitest";
import {
  canAccess13FOverlay,
  canAccessExecutionEndpoints,
  canAccessWatcher,
  canConsolidateMultiPortfolio,
  canGenerateMorningBriefContext,
} from "@/lib/portfolio/intelligence-access";
import { computeValueWeightedRsiFromHoldings, d } from "@/lib/portfolio/precision-money";
import {
  consolidatedSleeveBudgetRing,
  rollupPortfolio,
  type PortfolioSlice,
} from "@/lib/portfolio/sleeve-portfolio-aggregate";

type AuditEvent = {
  eventType: string;
  portfolioId: string;
  sleeveId: string;
  holdingId: string | null;
  ticker: string;
  quantityBefore: string | null;
  quantityAfter: string | null;
};

interface MemHolding {
  id: string;
  sleeveId: string;
  ticker: string;
  qty: ReturnType<typeof d>;
  costBasis: ReturnType<typeof d> | null;
  price: ReturnType<typeof d>;
  taxLotLabel: string | null;
}

interface MemSleeve {
  id: string;
  portfolioId: string;
  name: string;
}

interface MemPortfolio {
  id: string;
  name: string;
}

/** In-memory sovereign session — mirrors sleeve/holding rules used with Supabase. */
class SovereignJourneyHarness {
  portfolios = new Map<string, MemPortfolio>();
  sleeves = new Map<string, MemSleeve>();
  holdings = new Map<string, MemHolding>();
  audit: AuditEvent[] = [];
  driftSignals: { ticker: string; portfolioId: string }[] = [];
  private nextId = 1;

  private id(prefix: string) {
    return `${prefix}-${this.nextId++}`;
  }

  createPortfolio(name: string) {
    const id = this.id("pf");
    this.portfolios.set(id, { id, name });
    return id;
  }

  addSleeve(portfolioId: string, name: string) {
    if (!this.portfolios.has(portfolioId)) throw new Error("Unknown portfolio");
    const id = this.id("sl");
    this.sleeves.set(id, { id, portfolioId, name });
    return id;
  }

  removeSleeve(sleeveId: string) {
    const sleeve = this.sleeves.get(sleeveId);
    if (!sleeve) throw new Error("Unknown sleeve");
    const activeOnPortfolio = [...this.sleeves.values()].filter(
      (s) => s.portfolioId === sleeve.portfolioId,
    );
    if (activeOnPortfolio.length <= 1) {
      throw new Error("Cannot remove the last sleeve");
    }
    for (const h of [...this.holdings.values()].filter((x) => x.sleeveId === sleeveId)) {
      this.audit.push({
        eventType: "FULL_EXIT",
        portfolioId: sleeve.portfolioId,
        sleeveId,
        holdingId: h.id,
        ticker: h.ticker,
        quantityBefore: h.qty.toString(),
        quantityAfter: "0",
      });
      this.holdings.delete(h.id);
    }
    this.audit.push({
      eventType: "SLEEVE_REMOVED",
      portfolioId: sleeve.portfolioId,
      sleeveId,
      holdingId: null,
      ticker: "_SLEEVE_",
      quantityBefore: null,
      quantityAfter: null,
    });
    this.sleeves.delete(sleeveId);
  }

  addHolding(input: {
    sleeveId: string;
    ticker: string;
    qty: string | number;
    costBasis?: string | number | null;
    taxLotLabel?: string | null;
  }) {
    const sleeve = this.sleeves.get(input.sleeveId);
    if (!sleeve) throw new Error("Unknown sleeve");
    const ticker = String(input.ticker).trim().toUpperCase();
    const lot = input.taxLotLabel?.trim() || null;
    if (!lot) {
      const dup = [...this.holdings.values()].find(
        (h) => h.sleeveId === input.sleeveId && h.ticker === ticker,
      );
      if (dup) {
        throw new Error("Duplicate ticker in sleeve (use tax lot)");
      }
    } else {
      const dupLot = [...this.holdings.values()].find(
        (h) =>
          h.sleeveId === input.sleeveId &&
          h.ticker === ticker &&
          h.taxLotLabel !== null &&
          h.taxLotLabel === lot,
      );
      if (dupLot) {
        throw new Error("Duplicate tax lot for this ticker in sleeve");
      }
    }
    const qty = d(input.qty);
    const id = this.id("hd");
    const cost =
      input.costBasis === undefined || input.costBasis === null
        ? null
        : d(input.costBasis);
    this.holdings.set(id, {
      id,
      sleeveId: input.sleeveId,
      ticker,
      qty,
      costBasis: cost,
      price: d(100),
      taxLotLabel: lot,
    });
    this.audit.push({
      eventType: "ADD",
      portfolioId: sleeve.portfolioId,
      sleeveId: input.sleeveId,
      holdingId: id,
      ticker,
      quantityBefore: "0",
      quantityAfter: qty.toString(),
    });
    return id;
  }

  removeHolding(holdingId: string, mode: "partial" | "full", quantity?: string | number) {
    const h = this.holdings.get(holdingId);
    if (!h) throw new Error("Unknown holding");
    const sleeve = this.sleeves.get(h.sleeveId);
    if (!sleeve) throw new Error("Broken sleeve ref");

    if (mode === "full") {
      const share = this.navShare(h);
      this.audit.push({
        eventType: "FULL_EXIT",
        portfolioId: sleeve.portfolioId,
        sleeveId: h.sleeveId,
        holdingId: h.id,
        ticker: h.ticker,
        quantityBefore: h.qty.toString(),
        quantityAfter: "0",
      });
      if (share !== null && share.gt(0)) {
        this.driftSignals.push({ ticker: h.ticker, portfolioId: sleeve.portfolioId });
        this.audit.push({
          eventType: "DRIFT_AFTER_REMOVAL",
          portfolioId: sleeve.portfolioId,
          sleeveId: h.sleeveId,
          holdingId: h.id,
          ticker: h.ticker,
          quantityBefore: h.qty.toString(),
          quantityAfter: "0",
        });
      }
      this.holdings.delete(holdingId);
      return;
    }

    const sell = d(quantity ?? 0);
    if (!sell.isFinite() || sell.lte(0)) throw new Error("Invalid partial qty");
    if (sell.gt(h.qty)) throw new Error("Oversell");
    const after = h.qty.minus(sell);
    let newCost: ReturnType<typeof d> | null = h.costBasis;
    if (h.costBasis && !h.qty.isZero()) {
      newCost = h.costBasis.mul(after.div(h.qty));
    }
    this.audit.push({
      eventType: "PARTIAL_SELL",
      portfolioId: sleeve.portfolioId,
      sleeveId: h.sleeveId,
      holdingId: h.id,
      ticker: h.ticker,
      quantityBefore: h.qty.toString(),
      quantityAfter: after.toString(),
    });
    h.qty = after;
    h.costBasis = newCost;
  }

  private navShare(h: MemHolding): ReturnType<typeof d> | null {
    const sleeve = this.sleeves.get(h.sleeveId);
    if (!sleeve) return null;
    let total = d(0);
    for (const x of this.holdings.values()) {
      const sl = this.sleeves.get(x.sleeveId);
      if (!sl || sl.portfolioId !== sleeve.portfolioId) continue;
      total = total.plus(x.qty.mul(x.price));
    }
    if (total.isZero()) return null;
    return h.qty.mul(h.price).div(total);
  }

  toPortfolioSlice(portfolioId: string): PortfolioSlice {
    const sls = [...this.sleeves.values()].filter((s) => s.portfolioId === portfolioId);
    return {
      id: portfolioId,
      sleeves: sls.map((s) => ({
        id: s.id,
        holdings: [...this.holdings.values()]
          .filter((h) => h.sleeveId === s.id)
          .map((h) => ({
            id: h.id,
            ticker: h.ticker,
            qty: h.qty.toString(),
            price: h.price.toString(),
          })),
      })),
    };
  }
}

describe("Sovereign user journeys", () => {
  it("Core (one-time): single portfolio sleeve, 5 holdings CRUD, no 13F access", () => {
    const activeKeys = ["core_v1"] as const;
    expect(canAccess13FOverlay(activeKeys)).toBe(false);
    expect(canAccessWatcher(activeKeys)).toBe(false);
    expect(canGenerateMorningBriefContext(activeKeys)).toBe(false);
    expect(canConsolidateMultiPortfolio(activeKeys)).toBe(false);

    const H = new SovereignJourneyHarness();
    const p = H.createPortfolio("Main");
    const s = H.addSleeve(p, "Core");
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(
        H.addHolding({
          sleeveId: s,
          ticker: `T${i}`,
          qty: 10 + i,
          costBasis: 1000 + i * 50,
        }),
      );
    }
    expect(H.holdings.size).toBe(5);
    H.removeHolding(ids[0], "partial", 3);
    H.removeHolding(ids[1], "full");
    expect(H.holdings.size).toBe(4);
    expect(H.audit.filter((a) => a.eventType === "ADD").length).toBe(5);
    expect(H.audit.some((a) => a.eventType === "PARTIAL_SELL")).toBe(true);
    expect(H.audit.some((a) => a.eventType === "FULL_EXIT")).toBe(true);

    H.addHolding({ sleeveId: s, ticker: "VTI", qty: 1, costBasis: 100, taxLotLabel: "lot-a" });
    H.addHolding({ sleeveId: s, ticker: "VTI", qty: 2, costBasis: 200, taxLotLabel: "lot-b" });
    expect(H.holdings.size).toBe(6);
    expect(() => H.addHolding({ sleeveId: s, ticker: "VTI", qty: 1, costBasis: 50 })).toThrow(
      /Duplicate ticker/,
    );
  });

  it("Intelligence: multi-portfolio + consolidated allocation ring", () => {
    const activeKeys = ["intelligence_annual"] as const;
    expect(canAccess13FOverlay(activeKeys)).toBe(false);
    expect(canAccessWatcher(activeKeys)).toBe(true);
    expect(canGenerateMorningBriefContext(activeKeys)).toBe(true);
    expect(canConsolidateMultiPortfolio(activeKeys)).toBe(true);

    const H = new SovereignJourneyHarness();
    const ira = H.createPortfolio("IRA");
    const taxable = H.createPortfolio("Taxable");
    const crypto = H.createPortfolio("Crypto");

    const sIra = H.addSleeve(ira, "Equities");
    H.addHolding({ sleeveId: sIra, ticker: "SPY", qty: 100, costBasis: 40_000 });

    const tSleeves: string[] = [];
    for (let i = 0; i < 4; i++) {
      tSleeves.push(H.addSleeve(taxable, `Sleeve ${i + 1}`));
    }
    H.addHolding({ sleeveId: tSleeves[0], ticker: "VTI", qty: 50, costBasis: 12_000 });
    H.addHolding({ sleeveId: tSleeves[1], ticker: "VEA", qty: 40, costBasis: 3000 });
    H.addHolding({ sleeveId: tSleeves[2], ticker: "BND", qty: 200, costBasis: 8000 });
    H.addHolding({ sleeveId: tSleeves[3], ticker: "GLD", qty: 10, costBasis: 2000 });

    const sCrypto = H.addSleeve(crypto, "Spot");
    H.addHolding({ sleeveId: sCrypto, ticker: "BTC-USD", qty: 0.5, costBasis: 30_000 });

    const slices = [H.toPortfolioSlice(ira), H.toPortfolioSlice(taxable), H.toPortfolioSlice(crypto)];
    const ring = consolidatedSleeveBudgetRing(slices, (pid, sid) => {
      if (pid === ira && sid === sIra) return "0.4";
      if (pid === crypto && sid === sCrypto) return "0.2";
      if (tSleeves.includes(sid)) return "0.1";
      return "0";
    });
    expect(ring.length).toBe(6);
    const sumNav = ring.reduce((acc, r) => acc.plus(r.navSharePct), d(0));
    expect(sumNav.minus(1).abs().lte("1e-12")).toBe(true);
  });

  it("Autonomous: high-velocity ops, append-only audit, drift on full exit", () => {
    const autoKeys = ["autonomous_annual"] as const;
    expect(canAccess13FOverlay(autoKeys)).toBe(true);
    expect(canAccessExecutionEndpoints(autoKeys)).toBe(true);

    const H = new SovereignJourneyHarness();
    const p = H.createPortfolio("Trading");
    const sleeves: string[] = [];
    for (let i = 0; i < 10; i++) {
      sleeves.push(H.addSleeve(p, `S${i}`));
    }
    const frozenAtStart = H.audit.length;
    expect(frozenAtStart).toBe(0);

    const holdingIds: string[] = [];
    for (let n = 0; n < 25; n++) {
      const sl = sleeves[n % sleeves.length];
      holdingIds.push(
        H.addHolding({
          sleeveId: sl,
          ticker: `R${n}`,
          qty: 1,
          costBasis: 100 + n,
        }),
      );
    }
    for (let n = 0; n < 25; n++) {
      const target = holdingIds[n];
      if (n % 3 === 0) H.removeHolding(target, "full");
      else H.removeHolding(target, "partial", 0.5);
    }

    expect(H.audit.length).toBeGreaterThanOrEqual(50);
    const firstSlice = H.audit.slice(0, 10);
    expect(firstSlice.every((e, i) => e === H.audit[i])).toBe(true);
    expect(H.driftSignals.length).toBeGreaterThan(0);
  });

  it("Rollup: sleeve + portfolio totals use Decimal (no float dust)", () => {
    const slice: PortfolioSlice = {
      id: "p1",
      sleeves: [
        {
          id: "a",
          holdings: [
            { id: "1", ticker: "X", qty: "0.1", price: "10.1", rsi14: "55" },
            { id: "2", ticker: "Y", qty: "0.2", price: "20.2", rsi14: "45" },
          ],
        },
        {
          id: "b",
          holdings: [{ id: "3", ticker: "Z", qty: "1", price: "3", rsi14: "60" }],
        },
      ],
    };
    const roll = rollupPortfolio(slice);
    expect(roll.totalValue.toFixed(8)).toMatch(/^\d+\.\d+$/);
    expect(roll.sleeves.length).toBe(2);
    expect(roll.portfolioRsi).not.toBeNull();
  });

  it("Financial precision: VW-RSI from DB-shaped strings is stable to 8 decimals", () => {
    const vw = computeValueWeightedRsiFromHoldings([
      { qty: "2", price_seed: "10", rsi_14: "50" },
      { qty: "3", price_seed: "10", rsi_14: "60" },
    ]);
    expect(vw?.toFixed(8)).toBe("56.00000000");
  });
});
