import { NextResponse } from "next/server";
import {
  PUBLIC_DEMO_ALLOCATION,
  PUBLIC_DEMO_FEATURES,
  PUBLIC_DEMO_HOLDINGS_COUNT,
  PUBLIC_DEMO_NAME,
  PUBLIC_DEMO_TOTAL_VALUE,
} from "@/lib/demo/public-demo-data";

export const runtime = "nodejs";

/** Public showcase data for /demo and homepage preview (no auth). */
export async function GET() {
  return NextResponse.json({
    name: PUBLIC_DEMO_NAME,
    total_value: PUBLIC_DEMO_TOTAL_VALUE,
    holdings_count: PUBLIC_DEMO_HOLDINGS_COUNT,
    currency: "USD",
    allocation: PUBLIC_DEMO_ALLOCATION,
    features: PUBLIC_DEMO_FEATURES,
    as_of: new Date().toISOString(),
  });
}
