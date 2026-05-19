import { NextResponse } from "next/server";
import { sendTrialExpiryReminders } from "@/lib/services/trial-reminder";

/**
 * CRON endpoint called daily to:
 * 1. Expire elapsed trials
 * 2. Send 7-day and 1-day trial expiry email reminders
 *
 * Protected by CRON_SECRET header check.
 */
export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  const expected = process.env.CRON_SECRET?.trim();

  if (!expected || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendTrialExpiryReminders();
    return NextResponse.json({
      ok: true,
      reminded: result.reminded,
      expired: result.expired,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[trial-reminder-cron] Fatal:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
