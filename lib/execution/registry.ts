import type { ExchangeName, IExecutionProvider, PlaceOrderInput, PlaceOrderResult } from "@/lib/execution/types";
import { isLiveExecutionMode, logStubModeWarning } from "@/lib/execution/execution-config";
import { AlpacaProvider } from "@/lib/execution/providers/alpaca";
import { CoinbaseAdvancedProvider } from "@/lib/execution/providers/coinbase-advanced";
import { KrakenProvider } from "@/lib/execution/providers/kraken";

const alpaca = new AlpacaProvider();
const kraken = new KrakenProvider();
const coinbase = new CoinbaseAdvancedProvider();

export function getExecutionProvider(exchange: ExchangeName): IExecutionProvider {
  switch (exchange) {
    case "alpaca":
      return alpaca;
    case "kraken":
      return kraken;
    case "coinbase_advanced":
      return coinbase;
    default: {
      const x: never = exchange;
      throw new Error(`Unknown exchange ${String(x)}`);
    }
  }
}

/** Stub/live gating — providers implement live REST only. */
export async function dispatchOrder(
  exchange: ExchangeName,
  input: PlaceOrderInput,
  apiKey: string,
  apiSecret: string,
): Promise<PlaceOrderResult> {
  if (!isLiveExecutionMode()) {
    logStubModeWarning(exchange, input);
    return {
      ok: true,
      externalId: `${exchange}-stub-${Date.now()}`,
      stub: true,
    };
  }

  const provider = getExecutionProvider(exchange);
  return provider.placeOrder(input, apiKey, apiSecret);
}
