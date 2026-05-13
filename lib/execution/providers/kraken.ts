import type { IExecutionProvider, PlaceOrderInput, PlaceOrderResult } from "@/lib/execution/types";

export class KrakenProvider implements IExecutionProvider {
  readonly exchange = "kraken" as const;

  async placeOrder(
    input: PlaceOrderInput,
    decryptedApiKey: string,
    decryptedSecret: string,
  ): Promise<PlaceOrderResult> {
    void decryptedApiKey;
    void decryptedSecret;
    void input;
    // Stub: real flow signs REST body with HMAC-SHA512 of (path + sha256(nonce + body)) using API secret.
    return { ok: true, externalId: `kraken-stub-${Date.now()}` };
  }
}
