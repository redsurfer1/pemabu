import { NextResponse } from "next/server";

export function adminResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    {
      data,
      meta: {
        count: Array.isArray(data) ? data.length : 1,
        timestamp: new Date().toISOString(),
      },
    },
    { status },
  );
}

export function adminErrorResponse(error: string, status = 400): NextResponse {
  return NextResponse.json({ error, meta: { timestamp: new Date().toISOString() } }, { status });
}
