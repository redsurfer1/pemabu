export function toRecord(v: unknown): Record<string, unknown> {
  return v as Record<string, unknown>;
}

export function toRecordOrNull(v: unknown): Record<string, unknown> | null {
  return v as Record<string, unknown> | null;
}

export function toRecordArray(v: unknown): Record<string, unknown>[] {
  return (v ?? []) as Record<string, unknown>[];
}

export function toRecordOrThrow(v: unknown): Record<string, unknown> {
  if (!v) throw new Error("Expected a record, got nullish value");
  return v as Record<string, unknown>;
}

export function toTypedOrNull<T extends Record<string, unknown>>(v: unknown): T | null {
  return v as T | null;
}
