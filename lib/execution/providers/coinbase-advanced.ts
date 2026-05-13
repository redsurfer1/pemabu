import crypto from "node:crypto";
import type { IExecutionProvider, PlaceOrderInput, PlaceOrderResult } from "@/lib/execution/types";

const COINBASE_DEFAULT_BASE = "https://api.coinbase.com";

function coinbaseBaseUrl(): string {
  if (process.env.COINBASE_USE_SANDBOX === "true") {
    return "https://api-public.sandbox.exchange.coinbase.com";
  }
  return process.env.COINBASE_API_BASE?.trim() || COINBASE_DEFAULT_BASE;
}

function buildCoinbaseSignature(
  timestamp: string,
  method: string,
  requestPath: string,
  body: string,
  apiSecret: string,
): string {
  const message = `${timestamp}${method}${requestPath}${body}`;
  return crypto.createHmac("sha256", apiSecret).update(message).digest("hex");
}

export class CoinbaseAdvancedProvider implements IExecutionProvider {
  readonly exchange = "coinbase_advanced" as const;

  async placeOrder(
    input: PlaceOrderInput,
    decryptedApiKey: string,
    decryptedSecret: string,
  ): Promise<PlaceOrderResult> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const requestPath = "/api/v3/brokerage/orders";
      const method = "POST";
      const passphrase = process.env.COINBASE_API_PASSPHRASE ?? "";

      const orderBody: Record<string, unknown> = {
        client_order_id: `pemabu-${Date.now()}`,
        product_id: input.ticker,
        side: input.side === "buy" ? "BUY" : "SELL",
        order_configuration: {
          market_market_ioc: input.notionalUsd && Number(input.notionalUsd) > 0
            ? { quote_size: String(input.notionalUsd) }
            : { base_size: String(input.quantity ?? "0") },
        },
      };

      const bodyString = JSON.stringify(orderBody);
      const signature = buildCoinbaseSignature(
        timestamp,
        method,
        requestPath,
        bodyString,
        decryptedSecret,
      );

      const base = coinbaseBaseUrl();
      const response = await fetch(`${base}${requestPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CB-ACCESS-KEY": decryptedApiKey,
          "CB-ACCESS-SIGN": signature,
          "CB-ACCESS-TIMESTAMP": timestamp,
          "CB-ACCESS-PASSPHRASE": passphrase,
        },
        body: bodyString,
      });

      const raw = await response.text();
      let data: {
        success?: boolean;
        order_id?: string;
        error_response?: { message?: string };
      } = {};
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        return {
          ok: false,
          errorCode: "COINBASE_PARSE",
          error: raw.slice(0, 500),
          stub: false,
        };
      }

      if (!response.ok || data.success === false) {
        return {
          ok: false,
          errorCode: `COINBASE_HTTP_${response.status}`,
          error: data.error_response?.message ?? raw.slice(0, 500),
          stub: false,
        };
      }

      return {
        ok: true,
        externalId: data.order_id ?? `coinbase-${Date.now()}`,
        stub: false,
      };
    } catch (err) {
      return {
        ok: false,
        errorCode: "COINBASE_EXCEPTION",
        error: err instanceof Error ? err.message : String(err),
        stub: false,
      };
    }
  }
}
