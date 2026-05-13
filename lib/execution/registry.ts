import type { ExchangeName, IExecutionProvider } from "@/lib/execution/types";
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
