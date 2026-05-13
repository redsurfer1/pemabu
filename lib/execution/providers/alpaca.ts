import type { IExecutionProvider, PlaceOrderInput, PlaceOrderResult } from "@/lib/execution/types";

export class AlpacaProvider implements IExecutionProvider {
  readonly exchange = "alpaca" as const;

  async placeOrder(
    input: PlaceOrderInput,
    decryptedApiKey: string,
    decryptedSecret: string,
  ): Promise<PlaceOrderResult> {
    void decryptedApiKey;
    void decryptedSecret;
    void input;
    // Stub: real implementation would set OAuth / APCA headers and POST /v2/orders.
    return { ok: true, externalId: `alpaca-stub-${Date.now()}` };
  }
}
