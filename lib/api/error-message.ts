import { toRecord } from "@/lib/supabase/typed";

/** Zod safeParse flatten() shape when returned as `error` in JSON. */
interface ZodFlattened {
  formErrors?: string[];
  fieldErrors?: Record<string, string[]>;
}

function isZodFlattened(value: unknown): value is ZodFlattened {
  return (
    value != null &&
    typeof value === "object" &&
    ("formErrors" in value || "fieldErrors" in value)
  );
}

function formatZodFlattened(flat: ZodFlattened): string {
  const parts: string[] = [...(flat.formErrors ?? [])];
  for (const [field, messages] of Object.entries(flat.fieldErrors ?? {})) {
    if (messages?.length) parts.push(`${field}: ${messages.join(", ")}`);
  }
  return parts.length > 0 ? parts.join("; ") : "Validation failed";
}

/**
 * Normalises API / thrown values into a user-visible string.
 * Prevents React rendering "[object Object]" when an error payload is nested.
 */
export function getErrorMessage(value: unknown, fallback = "Something went wrong"): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  if (value instanceof Error) return value.message.trim() || fallback;

  if (typeof value === "object") {
    if (isZodFlattened(value)) return formatZodFlattened(value);

    const rec = toRecord(value);
    if (typeof rec.message === "string" && rec.message.trim()) return rec.message.trim();
    if (typeof rec.error === "string" && rec.error.trim()) return rec.error.trim();
    if (rec.error != null) return getErrorMessage(rec.error, fallback);
    if (typeof rec.publicMessage === "string" && rec.publicMessage.trim()) {
      return rec.publicMessage.trim();
    }
    if (typeof rec.reason === "string" && rec.reason.trim()) return rec.reason.trim();
  }

  try {
    const json = JSON.stringify(value);
    if (json && json !== "{}") return json;
  } catch {
    /* ignore */
  }

  return fallback;
}

/** Reads `{ error?: unknown }` from a failed fetch JSON body. */
export function errorMessageFromResponseBody(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    return getErrorMessage((body as { error: unknown }).error, fallback);
  }
  return fallback;
}
