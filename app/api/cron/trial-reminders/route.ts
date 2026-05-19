import { NextResponse } from "next/server";
import { sendTrialExpiryReminders } from "@/lib/services/trial-reminder";
import { withCronSentry } from "@/lib/monitoring/cron-sentry";

const handler = async (req: Request): Promise<Response> => {
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
};

export const GET = withCronSentry("trial-reminders", handler);
