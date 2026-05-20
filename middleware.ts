import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { checkAccess } from "@/lib/access/checkAccess";
import { LEGAL_ROUTES } from "@/lib/constants/compliance";
import { ADMIN_FORBIDDEN_RESPONSE, isAdminUser } from "@/lib/auth/require-admin";

/**
 * Public paths that do NOT require authentication.
 * Everything else matched by the wildcard matcher below is protected by default.
 * Add new public marketing/auth pages here; workspace routes are protected automatically.
 */
const PUBLIC_PATH_PREFIXES = [
  "/",           // exact home — checked separately via === below
  "/about",
  "/pricing",
  "/founding-publishers",
  "/creator/",
  "/family-view",
  "/crypto",
  "/request-access",
  "/demo",
  LEGAL_ROUTES.terms,
  LEGAL_ROUTES.privacy,
  LEGAL_ROUTES.disclaimer,
  "/auth/",
  "/api/stripe/",  // Stripe webhooks and public Stripe-facing endpoints
  "/api/public/",  // explicitly public API surface
  "/api/family/view", // token-only family portfolio view (no session)
  "/api/cron/",    // Vercel cron + CRON_SECRET bearer routes (auth inside handlers)
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some((p) => p !== "/" && (pathname === p.replace(/\/$/, "") || pathname.startsWith(p)));
}

/** Inverse: anything that is NOT a public path requires auth. */
function isProtectedPath(pathname: string): boolean {
  return !isPublicPath(pathname);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }
    if (isProtectedPath(pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (pathname.startsWith("/api/admin")) {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const isAdmin = await isAdminUser(user.id);
    if (!isAdmin) {
      return ADMIN_FORBIDDEN_RESPONSE;
    }
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pemabu-admin", "true");
    requestHeaders.set("x-pemabu-user-id", user.id);
    const out = NextResponse.next({
      request: { headers: requestHeaders },
    });
    supabaseResponse.cookies.getAll().forEach((c) => {
      out.cookies.set(c.name, c.value);
    });
    return out;
  }

  if (!user && isProtectedPath(pathname)) {
    const redirectRes = NextResponse.redirect(new URL("/", request.url));
    supabaseResponse.cookies.getAll().forEach((c) => {
      redirectRes.cookies.set(c.name, c.value);
    });
    return redirectRes;
  }

  if (user && checkAccess(request.nextUrl.pathname).blocked) {
    return NextResponse.redirect(new URL("/request-access", request.url));
  }

  return supabaseResponse;
}

/**
 * Wildcard matcher — runs middleware on every route except:
 *   • Next.js static build assets  (_next/static, _next/image)
 *   • favicon and common static file extensions
 *
 * This means any new workspace route is automatically protected without
 * requiring a manual update to this list. Public pages are carved out by
 * isPublicPath() / isProtectedPath() above, not by the matcher.
 */
export const config = {
  matcher: [
    "/api/admin/:path*",
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)).*)",
  ],
};
