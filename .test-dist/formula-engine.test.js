"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const formula_engine_js_1 = require("./formula-engine.js");
const EPS = 0.0001;
function approx(actual, expected, message) {
    strict_1.default.ok(Math.abs(actual - expected) < EPS, message ?? `expected ${actual} ≈ ${expected}`);
}
(0, node_test_1.default)("colJ", () => {
    approx((0, formula_engine_js_1.colJ)(597, 67.63), 40375.11);
});
(0, node_test_1.default)("colD", () => {
    approx((0, formula_engine_js_1.colD)(40385.11, 516823.47), 0.0781435026);
});
(0, node_test_1.default)("colH", () => {
    strict_1.default.equal((0, formula_engine_js_1.colH)(0, 40385.11), 0);
    approx((0, formula_engine_js_1.colH)(119, 40385.11), 0.0029471272);
});
(0, node_test_1.default)("colO", () => {
    approx((0, formula_engine_js_1.colO)(48.13, 48.09), 0.0008317738);
});
(0, node_test_1.default)("colP", () => {
    approx((0, formula_engine_js_1.colP)(48.13, 46.39), 0.0375080836);
});
(0, node_test_1.default)("colV", () => {
    approx((0, formula_engine_js_1.colV)(48.13, 46.59), 0.0330543035);
});
(0, node_test_1.default)("colW", () => {
    approx((0, formula_engine_js_1.colW)(48.13, 44.61), 0.0789051782);
});
(0, node_test_1.default)("colX", () => {
    approx((0, formula_engine_js_1.colX)(48.13, 41.2), 0.1682038835);
});
(0, node_test_1.default)("colY", () => {
    approx((0, formula_engine_js_1.colY)(48.13, 37.79), 0.2736173591);
});
(0, node_test_1.default)("colZ", () => {
    approx((0, formula_engine_js_1.colZ)(48.13, 34.27), 0.4044353662);
});
(0, node_test_1.default)("colAA", () => {
    approx((0, formula_engine_js_1.colAA)([0.033068, 0.078905, 0.168204, 0.273617, 0.404438]), 0.1916464);
});
(0, node_test_1.default)("colAB", () => {
    approx((0, formula_engine_js_1.colAB)(0.033068, 0.078905, 0.168204, 0.273617, 0.404438, { r3mo: 0.4, r6mo: 0.25, r1yr: 0.2, r3yr: 0.1, r5yr: 0.05 }), 0.114122);
});
(0, node_test_1.default)("colAC", () => {
    approx((0, formula_engine_js_1.colAC)(0.033068), 0.0003674222);
});
(0, node_test_1.default)("colAD", () => {
    approx((0, formula_engine_js_1.colAD)(0.033068), 0.0003674222);
    approx((0, formula_engine_js_1.colAD)(-0.06), -0.0006666667);
});
(0, node_test_1.default)("colAK", () => {
    strict_1.default.equal((0, formula_engine_js_1.colAK)(2, 18, 5, 72, {
        expense: 0.3,
        pctWeight: 0.3,
        divApy: 0.15,
        volatility: 0.25,
    }), 24.75);
});
(0, node_test_1.default)("colAL", () => {
    strict_1.default.equal((0, formula_engine_js_1.colAL)(0.06), "Consider Entry");
    strict_1.default.equal((0, formula_engine_js_1.colAL)(-0.06), "Consider Exit");
    strict_1.default.equal((0, formula_engine_js_1.colAL)(0.02), "Hold");
    strict_1.default.equal((0, formula_engine_js_1.colAL)(0.05), "Hold");
    strict_1.default.equal((0, formula_engine_js_1.colAL)(-0.05), "Hold");
});
(0, node_test_1.default)("colAM", () => {
    strict_1.default.equal((0, formula_engine_js_1.colAM)(75), "Consider Exit");
    strict_1.default.equal((0, formula_engine_js_1.colAM)(25), "Consider Entry");
    strict_1.default.equal((0, formula_engine_js_1.colAM)(50), "Hold");
    strict_1.default.equal((0, formula_engine_js_1.colAM)(70), "Hold");
    strict_1.default.equal((0, formula_engine_js_1.colAM)(30), "Hold");
    strict_1.default.equal((0, formula_engine_js_1.colAM)(null), "Loading…");
});
(0, node_test_1.default)("colAU", () => {
    strict_1.default.equal((0, formula_engine_js_1.colAU)(35), 0.0075);
    strict_1.default.equal((0, formula_engine_js_1.colAU)(40), 0.0075);
    strict_1.default.equal((0, formula_engine_js_1.colAU)(41), 0.0025);
    strict_1.default.equal((0, formula_engine_js_1.colAU)(50), 0.0025);
    strict_1.default.equal((0, formula_engine_js_1.colAU)(51), 0.0015);
    strict_1.default.equal((0, formula_engine_js_1.colAU)(55), 0.0015);
    strict_1.default.equal((0, formula_engine_js_1.colAU)(56), 0);
    strict_1.default.equal((0, formula_engine_js_1.colAU)(100), 0);
});
(0, node_test_1.default)("colAR", () => {
    approx((0, formula_engine_js_1.colAR)(0.0075, 516823.47), 3876.176025);
});
(0, node_test_1.default)("colAS", () => {
    approx((0, formula_engine_js_1.colAS)(3876.18, 40385.11), -36508.93);
});
(0, node_test_1.default)("colAT", () => {
    approx((0, formula_engine_js_1.colAT)(-36508.93, 67.63), -539.83335798);
});
(0, node_test_1.default)("computeRSI", () => {
    strict_1.default.equal((0, formula_engine_js_1.computeRSI)([]), null);
    strict_1.default.equal((0, formula_engine_js_1.computeRSI)([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]), null);
    const upOnly = (0, formula_engine_js_1.computeRSI)([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    strict_1.default.ok(upOnly !== null && upOnly > 90);
    const downOnly = (0, formula_engine_js_1.computeRSI)([15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    strict_1.default.ok(downOnly !== null && downOnly < 10);
    const mixed = [100, 102, 101, 103, 102, 104, 103, 105, 104, 106, 105, 107, 106, 108, 107];
    const mixedResult = (0, formula_engine_js_1.computeRSI)(mixed);
    strict_1.default.ok(mixedResult !== null && mixedResult >= 0 && mixedResult <= 100);
});
(0, node_test_1.default)("denseRank", () => {
    const desc = (0, formula_engine_js_1.denseRank)([30, 10, 20], false);
    strict_1.default.equal(desc.get(30), 1);
    strict_1.default.equal(desc.get(20), 2);
    strict_1.default.equal(desc.get(10), 3);
    const asc = (0, formula_engine_js_1.denseRank)([10, 20, 30], true);
    strict_1.default.equal(asc.get(10), 1);
    strict_1.default.equal(asc.get(20), 2);
    strict_1.default.equal(asc.get(30), 3);
    const withNull = (0, formula_engine_js_1.denseRank)([10, null, 20], false);
    strict_1.default.equal(withNull.get(20), 1);
    strict_1.default.equal(withNull.get(10), 2);
    strict_1.default.equal(withNull.has(null), false);
    const ties = (0, formula_engine_js_1.denseRank)([10, 10, 20], false);
    strict_1.default.equal(ties.get(20), 1);
    strict_1.default.equal(ties.get(10), 2);
});
(0, node_test_1.default)("computePortfolioRanks", () => {
    const rows = [
        {
            rowStatus: "Active",
            currentWeight: 0.10,
            expenseRatio: 0.001,
            returnWeightedAvg: 0.12,
            divApy: 0.02,
            volatilityAbs: 0.001,
            volatilitySigned: 0.001,
            compositeScore: null,
            rank_overall: null,
        },
        {
            rowStatus: "Active",
            currentWeight: 0.20,
            expenseRatio: 0.002,
            returnWeightedAvg: 0.08,
            divApy: 0.03,
            volatilityAbs: 0.002,
            volatilitySigned: 0.002,
            compositeScore: null,
            rank_overall: null,
        },
        {
            rowStatus: "Active",
            currentWeight: 0.30,
            expenseRatio: 0.003,
            returnWeightedAvg: 0.15,
            divApy: 0.01,
            volatilityAbs: 0.003,
            volatilitySigned: 0.003,
            compositeScore: null,
            rank_overall: null,
        },
        {
            rowStatus: "Comparable",
            currentWeight: 0.99,
            expenseRatio: 0.999,
            returnWeightedAvg: 0.99,
            divApy: 0.99,
            volatilityAbs: 0.99,
            volatilitySigned: 0.99,
            compositeScore: null,
            rank_overall: null,
        },
    ];
    const ranked = (0, formula_engine_js_1.computePortfolioRanks)(rows, formula_engine_js_1.DEFAULT_ASSUMPTIONS);
    const active = ranked.filter((r) => r.rowStatus === "Active");
    const comparable = ranked.find((r) => r.rowStatus === "Comparable");
    strict_1.default.equal(active.length, 3);
    active.forEach((row) => {
        strict_1.default.equal(typeof row.compositeScore, "number");
        strict_1.default.ok(Number.isInteger(row.subRankExpense));
        strict_1.default.ok((row.subRankExpense ?? 0) >= 1 && (row.subRankExpense ?? 0) <= 3);
    });
    strict_1.default.ok(comparable);
    strict_1.default.equal(comparable?.compositeScore, null);
    strict_1.default.equal(comparable?.rank_overall, null);
});
(0, node_test_1.default)("normaliseWeights", () => {
    const alreadyNormalised = (0, formula_engine_js_1.normaliseWeights)({
        r3mo: 0.4,
        r6mo: 0.25,
        r1yr: 0.2,
        r3yr: 0.1,
        r5yr: 0.05,
    });
    approx(alreadyNormalised.r3mo, 0.4);
    approx(alreadyNormalised.r6mo, 0.25);
    approx(alreadyNormalised.r1yr, 0.2);
    approx(alreadyNormalised.r3yr, 0.1);
    approx(alreadyNormalised.r5yr, 0.05);
    const equal = (0, formula_engine_js_1.normaliseWeights)({
        r3mo: 2,
        r6mo: 2,
        r1yr: 2,
        r3yr: 2,
        r5yr: 2,
    });
    approx(equal.r3mo, 0.2);
    approx(equal.r6mo, 0.2);
    approx(equal.r1yr, 0.2);
    approx(equal.r3yr, 0.2);
    approx(equal.r5yr, 0.2);
    const zero = (0, formula_engine_js_1.normaliseWeights)({
        r3mo: 0,
        r6mo: 0,
        r1yr: 0,
        r3yr: 0,
        r5yr: 0,
    });
    strict_1.default.deepEqual(zero, {
        r3mo: 0,
        r6mo: 0,
        r1yr: 0,
        r3yr: 0,
        r5yr: 0,
    });
});
