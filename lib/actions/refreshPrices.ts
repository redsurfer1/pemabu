"use server";

/**
 * Legacy server action wrapper.
 * Delegates to the new lib/actions/portfolio/refreshPortfolioPrices.ts.
 * Kept for backwards compatibility with existing PortfolioDashboard import.
 */
export { refreshPortfolioPrices as refreshPrices } from "./portfolio/refreshPortfolioPrices";
