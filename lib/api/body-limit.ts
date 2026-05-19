import { NextResponse } from "next/server";

export const DEFAULT_MAX_BYTES = 1_048_576; // 1 MB
export const STRIPE_WEBHOOK_MAX_BYTES = 5_242_880; // 5 MB (webhooks can be larger)

export async function readBody(req: Request, maxBytes: number = DEFAULT_MAX_BYTES): Promise<string> {
  const reader = req.body?.getReader();
  if (!reader) {
    throw new NextResponseError("Request body required", 400);
  }

  let received = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      reader.cancel();
      throw new NextResponseError("Request entity too large", 413);
    }
    chunks.push(value);
  }

  const encoder = new TextDecoder();
  return chunks.map((c) => encoder.decode(c, { stream: true })).join("");
}

export async function readJson<T = unknown>(req: Request, maxBytes: number = DEFAULT_MAX_BYTES): Promise<T> {
  const text = await readBody(req, maxBytes);
  return JSON.parse(text) as T;
}

export class NextResponseError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "NextResponseError";
  }
}

export function bodySizeGuard(req: Request, maxBytes: number = DEFAULT_MAX_BYTES): NextResponse | null {
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    return NextResponse.json({ error: "Request entity too large" }, { status: 413 });
  }
  return null;
}
