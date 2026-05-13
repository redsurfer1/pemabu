import Decimal from "decimal.js";

export type ExchangeName = "alpaca" | "kraken" | "coinbase_advanced";

export interface PlaceOrderInput {
  ticker: string;
  side: "buy" | "sell";
  /** Decimal string quantity */
  quantity: string;
  /** Optional notional cap hint (decimal string USD) */
  notionalUsd?: string;
}

export interface PlaceOrderResult {
  ok: boolean;
  externalId?: string;
  errorCode?: string;
  /** Human-readable exchange / network error (when ok is false). */
  error?: string;
  /** True when no real broker request was sent (stub / dry-run). */
  stub?: boolean;
}

/**
 * Exchange execution surface — implementations decrypt credentials only inside `placeOrder`.
 */
export interface IExecutionProvider {
  readonly exchange: ExchangeName;
  placeOrder(input: PlaceOrderInput, decryptedApiKey: string, decryptedSecret: string): Promise<PlaceOrderResult>;
}

export interface CredentialBundle {
  apiKey: string;
  secret: string;
}

/** Build Decimal string notional = qty * price (caller supplies Decimal). */
export function notionalFromQtyPrice(qty: Decimal, price: Decimal): string {
  return qty.mul(price).toFixed(4);
}
