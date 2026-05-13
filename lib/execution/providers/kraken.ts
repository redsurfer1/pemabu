import crypto from "node:crypto";
import type { IExecutionProvider, PlaceOrderInput, PlaceOrderResult } from "@/lib/execution/types";

const KRAKEN_API_BASE = "https://api.kraken.com";
const KRAKEN_PRIVATE_PATH = "/0/private/AddOrder";

/**
 * Kraken private API signature: HMAC-SHA512(secret, path + SHA256(nonce + postBody))
 * @see https://docs.kraken.com/rest/#section/Authentication/Headers-and-Signature
 */
function buildKrakenSignature(urlPath: string, postBody: string, apiSecretB64: string): string {
  const hash = crypto.createHash("sha256").update(postBody).digest();
  const secretBuffer = Buffer.from(apiSecretB64, "base64");
  return crypto
    .createHmac("sha512", secretBuffer)
    .update(Buffer.concat([Buffer.from(urlPath, "utf8"), hash]))
    .digest("base64");
}

export class KrakenProvider implements IExecutionProvider {
  readonly exchange = "kraken" as const;

  async placeOrder(
    input: PlaceOrderInput,
    decryptedApiKey: string,
    decryptedSecret: string,
  ): Promise<PlaceOrderResult> {
    try {
      const nonce = Date.now().toString();
      const volume = input.quantity?.trim() || "0";
      if (Number(volume) <= 0) {
        return {
          ok: false,
          errorCode: "INVALID_ORDER",
          error: "Kraken AddOrder requires positive volume (quantity)",
          stub: false,
        };
      }

      const postParams = new URLSearchParams({
        nonce,
        ordertype: "market",
        type: input.side,
        volume,
        pair: input.ticker,
      });
      const postBody = postParams.toString();
      const signature = buildKrakenSignature(KRAKEN_PRIVATE_PATH, postBody, decryptedSecret);

      const response = await fetch(`${KRAKEN_API_BASE}${KRAKEN_PRIVATE_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "API-Key": decryptedApiKey,
          "API-Sign": signature,
        },
        body: postBody,
      });

      const data = (await response.json()) as {
        error?: string[];
        result?: { txid?: string[] };
      };

      if (data.error && data.error.length > 0) {
        return {
          ok: false,
          errorCode: "KRAKEN_REJECTED",
          error: data.error.join(", "),
          stub: false,
        };
      }

      const txid = data.result?.txid?.[0];
      return {
        ok: true,
        externalId: txid ?? `kraken-${Date.now()}`,
        stub: false,
      };
    } catch (err) {
      return {
        ok: false,
        errorCode: "KRAKEN_EXCEPTION",
        error: err instanceof Error ? err.message : String(err),
        stub: false,
      };
    }
  }
}
