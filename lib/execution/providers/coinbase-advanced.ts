import type { IExecutionProvider, PlaceOrderInput, PlaceOrderResult } from "@/lib/execution/types";

export class CoinbaseAdvancedProvider implements IExecutionProvider {
  readonly exchange = "coinbase_advanced" as const;

  async placeOrder(
    input: PlaceOrderInput,
    decryptedApiKey: string,
    decryptedSecret: string,
  ): Promise<PlaceOrderResult> {
    void decryptedApiKey;
    void decryptedSecret;
    void input;
    return { ok: true, externalId: `coinbase-stub-${Date.now()}` };
  }
}
