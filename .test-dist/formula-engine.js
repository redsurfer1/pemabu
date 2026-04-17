"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ASSUMPTIONS = void 0;
exports.colD = colD;
exports.colH = colH;
exports.colJ = colJ;
exports.colO = colO;
exports.colP = colP;
exports.colV = colV;
exports.colW = colW;
exports.colX = colX;
exports.colY = colY;
exports.colZ = colZ;
exports.colAA = colAA;
exports.colAB = colAB;
exports.colAC = colAC;
exports.colAD = colAD;
exports.colAK = colAK;
exports.colAL = colAL;
exports.colAM = colAM;
exports.computeRSI = computeRSI;
exports.colAU = colAU;
exports.colAR = colAR;
exports.colAS = colAS;
exports.colAT = colAT;
exports.denseRank = denseRank;
exports.computePortfolioRanks = computePortfolioRanks;
exports.normaliseWeights = normaliseWeights;
exports.DEFAULT_ASSUMPTIONS = {
    return_weights: { r3mo: 0.4, r6mo: 0.25, r1yr: 0.2, r3yr: 0.1, r5yr: 0.05 },
    factor_weights: { expense: 0.3, pctWeight: 0.3, divApy: 0.15, volatility: 0.25 },
};
function safeDiv(n, d) {
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0)
        return 0;
    return n / d;
}
function round(value, digits = 6) {
    if (!Number.isFinite(value))
        return 0;
    const p = 10 ** digits;
    return Math.round(value * p) / p;
}
function colD(marketValue, totalMV) {
    return round(safeDiv(marketValue, totalMV));
}
function colH(dividendDollars, marketValue) {
    return round(safeDiv(dividendDollars, marketValue));
}
function colJ(quantity, price) {
    return round((Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(price) ? price : 0), 4);
}
function colO(price1, price2) {
    return round(safeDiv(price1 - price2, price2));
}
function colP(price1, price3) {
    return round(safeDiv(price1 - price3, price3));
}
function colV(price1, basis3mo) {
    return round(safeDiv(price1 - basis3mo, basis3mo));
}
function colW(price1, basis6mo) {
    return round(safeDiv(price1 - basis6mo, basis6mo));
}
function colX(price1, basis1yr) {
    return round(safeDiv(price1 - basis1yr, basis1yr));
}
function colY(price1, basis3yr) {
    return round(safeDiv(price1 - basis3yr, basis3yr));
}
function colZ(price1, basis5yr) {
    return round(safeDiv(price1 - basis5yr, basis5yr));
}
function colAA(returns) {
    const values = returns.filter((r) => Number.isFinite(r));
    if (values.length === 0)
        return 0;
    return round(values.reduce((s, r) => s + r, 0) / values.length);
}
function colAB(r3mo, r6mo, r1yr, r3yr, r5yr, weights) {
    return round(r3mo * weights.r3mo +
        r6mo * weights.r6mo +
        r1yr * weights.r1yr +
        r3yr * weights.r3yr +
        r5yr * weights.r5yr);
}
function colAC(return3mo) {
    return round(Math.abs(return3mo / 90));
}
function colAD(return3mo) {
    return round(return3mo / 90);
}
function colAK(subRankExpense, subRankWeightedRet, subRankDivApy, subRankVolatility, weights) {
    return round(subRankExpense * weights.expense +
        subRankWeightedRet * weights.pctWeight +
        subRankDivApy * weights.divApy +
        subRankVolatility * weights.volatility, 4);
}
function colAL(returnWeightedAvg) {
    if (returnWeightedAvg > 0.05)
        return "Consider Entry";
    if (returnWeightedAvg < -0.05)
        return "Consider Exit";
    return "Hold";
}
function colAM(rsi) {
    if (rsi == null || !Number.isFinite(rsi))
        return "Loading…";
    if (rsi > 70)
        return "Consider Exit";
    if (rsi < 30)
        return "Consider Entry";
    return "Hold";
}
function computeRSI(closes) {
    const values = closes.filter((c) => Number.isFinite(c));
    if (values.length < 15)
        return null;
    const p = values.slice(-15);
    let gains = 0;
    let losses = 0;
    for (let i = 1; i < p.length; i++) {
        const delta = p[i] - p[i - 1];
        if (delta > 0)
            gains += delta;
        else
            losses += Math.abs(delta);
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    if (avgLoss === 0)
        return 100;
    const rs = avgGain / avgLoss;
    return round(100 - 100 / (1 + rs), 2);
}
function colAU(rankOverall) {
    if (!Number.isFinite(rankOverall))
        return 0;
    if (rankOverall > 55)
        return 0;
    if (rankOverall <= 40)
        return 0.0075;
    if (rankOverall <= 50)
        return 0.0025;
    return 0.0015;
}
function colAR(targetSleevePct, totalMV) {
    return round(targetSleevePct * totalMV, 4);
}
function colAS(parityDollars, marketValue) {
    return round(parityDollars - marketValue, 4);
}
function colAT(parityChangeDollars, price) {
    return round(safeDiv(parityChangeDollars, price), 6);
}
function denseRank(values, ascending = false) {
    const uniques = [...new Set(values.filter((v) => v != null && Number.isFinite(v)))];
    uniques.sort((a, b) => (ascending ? a - b : b - a));
    const m = new Map();
    uniques.forEach((v, i) => m.set(v, i + 1));
    return m;
}
function computePortfolioRanks(rows, assumptions) {
    const active = rows.map((r, idx) => ({ r, idx })).filter((x) => x.r.rowStatus === "Active");
    const currentRank = denseRank(active.map((x) => x.r.currentWeight ?? null), false);
    const expenseRank = denseRank(active.map((x) => x.r.expenseRatio ?? null), true);
    const wretRank = denseRank(active.map((x) => x.r.returnWeightedAvg ?? null), false);
    const divRank = denseRank(active.map((x) => x.r.divApy ?? null), false);
    const volRank = denseRank(active.map((x) => x.r.volatilityAbs ?? null), true);
    const volSignedRank = denseRank(active.map((x) => x.r.volatilitySigned ?? null), false);
    const out = rows.map((r) => ({ ...r }));
    active.forEach(({ r, idx }) => {
        const srCurrent = r.currentWeight != null ? (currentRank.get(r.currentWeight) ?? null) : null;
        const srExpense = r.expenseRatio != null ? (expenseRank.get(r.expenseRatio) ?? null) : null;
        const srWRet = r.returnWeightedAvg != null ? (wretRank.get(r.returnWeightedAvg) ?? null) : null;
        const srDiv = r.divApy != null ? (divRank.get(r.divApy) ?? null) : null;
        const srVol = r.volatilityAbs != null ? (volRank.get(r.volatilityAbs) ?? null) : null;
        const srVolSigned = r.volatilitySigned != null ? (volSignedRank.get(r.volatilitySigned) ?? null) : null;
        const composite = srExpense != null && srWRet != null && srDiv != null && srVol != null
            ? colAK(srExpense, srWRet, srDiv, srVol, assumptions.factor_weights)
            : null;
        Object.assign(out[idx], {
            subRankCurrent: srCurrent,
            subRankExpense: srExpense,
            subRankWeightedRet: srWRet,
            subRankDivApy: srDiv,
            subRankVolatility: srVol,
            subRankVolSigned: srVolSigned,
            compositeScore: composite,
        });
    });
    return out;
}
function normaliseWeights(weights) {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (sum === 0)
        return weights;
    return Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, v / sum]));
}
