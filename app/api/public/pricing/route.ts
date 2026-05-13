import { NextResponse } from "next/server";
import { getCachedServices } from "@/lib/cache/service-catalog";

/** Public catalog — no auth. Active services only. */
export async function GET() {
  const services = await getCachedServices();
  const active = services.filter((s) => s.is_active);

  return NextResponse.json(
    { data: active, meta: { count: active.length, timestamp: new Date().toISOString() } },
    {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=60",
      },
    },
  );
}
