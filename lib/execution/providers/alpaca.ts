import type { IExecutionProvider, PlaceOrderInput, PlaceOrderResult } from "@/lib/execution/types";
import { isLiveExecutionMode, logStubModeWarning } from "@/lib/execution/execution-config";

const ALPACA_PAPER_BASE = "https://paper-api.alpaca.markets/v2";
const ALPACA_LIVE_BASE = "https://api.alpaca.markets/v2";

export class AlpacaProvider implements IExecutionProvider {
  readonly exchange = "alpaca" as const;

  async placeOrder(
    input: PlaceOrderInput,
    decryptedApiKey: string,
    decryptedSecret: string,
  ): Promise<PlaceOrderResult> {
    if (!isLiveExecutionMode()) {
      logStubModeWarning("Alpaca", input);
      return {
        ok: true,
        externalId: `alpaca-stub-${Date.now()}`,
        stub: true,
      };
    }

    try {
      const baseUrl =
        process.env.ALPACA_USE_LIVE === "true" ? ALPACA_LIVE_BASE : ALPACA_PAPER_BASE;

      const orderBody: Record<string, unknown> = {
        symbol: input.ticker,
        side: input.side,
        type: "market",
        time_in_force: "day",
      };

      const qty = input.quantity?.trim();
      if (qty && Number(qty) > 0) {
        orderBody.qty = qty;
      } else if (input.notionalUsd && Number(input.notionalUsd) > 0) {
        orderBody.notional = input.notionalUsd;
      } else {
        return {
          ok: false,
          errorCode: "INVALID_ORDER",
          error: "Alpaca order requires positive quantity or notionalUsd",
          stub: false,
        };
      }

      Object.keys(orderBody).forEach((k) => {
        if (orderBody[k] === undefined) delete orderBody[k];
      });

      const response = await fetch(`${baseUrl}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "APCA-API-KEY-ID": decryptedApiKey,
          "APCA-API-SECRET-KEY": decryptedSecret,
        },
        body: JSON.stringify(orderBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          ok: false,
          errorCode: `ALPACA_HTTP_${response.status}`,
          error: `Alpaca API error ${response.status}: ${errorBody}`,
          stub: false,
        };
      }

      const order = (await response.json()) as { id: string; status?: string };
      return {
        ok: true,
        externalId: order.id,
        stub: false,
      };
    } catch (err) {
      return {
        ok: false,
        errorCode: "ALPACA_EXCEPTION",
        error: err instanceof Error ? err.message : String(err),
        stub: false,
      };
    }
  }
}
