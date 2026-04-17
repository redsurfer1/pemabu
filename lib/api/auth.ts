// lib/api/auth.ts
// Server-side auth helper for API route handlers.
// Returns the verified user or throws a Response.

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

export async function getAuthenticatedUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

/** Context passed to App Router route handlers (params is always a Promise). */
export type RouteHandlerContext = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

// Wrap a route handler with auth — catches the
// thrown Response and returns it directly
export function withAuth(
  handler: (req: Request, user: User, context: RouteHandlerContext) => Promise<Response>,
) {
  return async (req: Request, context: RouteHandlerContext): Promise<Response> => {
    try {
      const user = await getAuthenticatedUser();
      return await handler(req, user, context);
    } catch (e) {
      if (e instanceof Response) return e;
      console.error("Route error:", e);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
