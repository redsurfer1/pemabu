import { NextResponse } from "next/server";
import { getActiveProvider } from "@/lib/market-data";
import { alertOperator } from "@/lib/services/email";
import { withCronSentry } from "@/lib/monitoring/cron-sentry";

function verifyCronSecret(req: Request): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

const handler = async (req: Request) => {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const health = await getActiveProvider().healthCheck();
    return NextResponse.json({
      status: "ok",
      provider_health: health,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await alertOperator("Cron health check FAILED", `Error: ${msg}`).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }
};

export const GET = withCronSentry("cron-health", handler);
