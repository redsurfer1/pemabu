import { getBaseUrl } from "@/lib/app-url";

/** Origins that are allowed to make mutation requests. */
const MUTATION_ALLOWED_ORIGINS = new Set<string>();

let _originsInit = false;
function initAllowedOrigins(): void {
  if (_originsInit) return;
  _originsInit = true;

  const appUrl = getBaseUrl();
  try {
    const u = new URL(appUrl);
    MUTATION_ALLOWED_ORIGINS.add(u.origin);
  } catch {
    // ignore
  }

  const envOrigins = process.env.CORS_ALLOWED_ORIGINS;
  if (envOrigins) {
    for (const o of envOrigins.split(",")) {
      const trimmed = o.trim();
      if (trimmed) MUTATION_ALLOWED_ORIGINS.add(trimmed);
    }
  }

  // Always allow localhost for development
  MUTATION_ALLOWED_ORIGINS.add("http://localhost:3000");
  MUTATION_ALLOWED_ORIGINS.add("http://127.0.0.1:3000");
}

export function isOriginAllowed(origin: string): boolean {
  initAllowedOrigins();
  return MUTATION_ALLOWED_ORIGINS.has(origin);
}

export function extractOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (origin) return origin;

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }

  return null;
}

export function validateMutationOrigin(req: Request): Response | null {
  const origin = extractOrigin(req);

  // No origin/referer header — likely a server-to-server request, allow.
  if (!origin) return null;

  if (isOriginAllowed(origin)) return null;

  console.warn(`[origin] blocked mutation from origin: ${origin}`);
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}
