/**
 * Minimal S3-compatible PUT uploader using AWS Signature V4.
 * Works with AWS S3 and Backblaze B2 (S3-compatible API).
 * No SDK dependency — uses Node.js crypto + fetch.
 */
import crypto from "crypto";

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  /** Defaults to s3.amazonaws.com; set for Backblaze: s3.us-west-004.backblazeb2.com */
  endpoint?: string;
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function toHex(buf: Buffer): string {
  return buf.toString("hex");
}

export async function s3PutObject(
  creds: S3Credentials,
  bucket: string,
  key: string,
  body: Buffer,
  contentType = "application/octet-stream",
): Promise<void> {
  const endpoint = creds.endpoint ?? `s3.${creds.region}.amazonaws.com`;
  const host = `${bucket}.${endpoint}`;
  const url = `https://${host}/${key}`;

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""); // YYYYMMDDTHHmmssZ

  const payloadHash = sha256Hex(body);
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    "content-type": contentType,
    "content-length": String(body.byteLength),
  };

  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((k) => `${k}:${headers[k]}\n`)
    .join("");

  const canonicalRequest = [
    "PUT",
    `/${key}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${creds.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(Buffer.from(`AWS4${creds.secretAccessKey}`, "utf8"), dateStamp);
  const kRegion = hmacSha256(kDate, creds.region);
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = toHex(hmacSha256(kSigning, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...headers,
      Authorization: authorization,
    },
    body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`S3 PUT failed (${res.status}): ${text.slice(0, 200)}`);
  }
}
