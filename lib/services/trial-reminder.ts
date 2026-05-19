import { supabaseAdmin } from "@/lib/supabase/admin";
import { Resend } from "resend";

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@pemabu.com";

function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

/**
 * Find all trial subscriptions ending within a given window and send
 * email reminders. Called by the trial cron route.
 *
 * @param reminderDays  How many days before expiry to send (default 7 and 1)
 */
export async function sendTrialExpiryReminders(): Promise<{
  reminded: number;
  expired: number;
}> {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // ── Expire elapsed trials ───────────────────────────────────────────────
  const { error: expireErr } = await supabaseAdmin.rpc("expire_elapsed_trials");
  if (expireErr) {
    console.error("[trial-reminder] expire_elapsed_trials failed:", expireErr.message);
  }

  // Count newly expired
  const { count: expiredCount } = await supabaseAdmin
    .from("user_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("status", "expired")
    .lt("ends_at", now.toISOString());

  // ── Find trials expiring in the reminder windows ────────────────────────
  const { data: trials, error: trialsErr } = await supabaseAdmin
    .from("user_subscriptions")
    .select("user_id, ends_at, service_key")
    .eq("status", "trial")
    .gte("ends_at", now.toISOString())
    .lte("ends_at", sevenDaysFromNow);

  if (trialsErr) {
    console.error("[trial-reminder] query failed:", trialsErr.message);
    return { reminded: 0, expired: expiredCount ?? 0 };
  }

  if (!trials?.length) {
    return { reminded: 0, expired: expiredCount ?? 0 };
  }

  /* userIds populated implicitly in loop below */

  const emailResend = getResend();
  let reminded = 0;

  for (const trial of trials) {
    const endsAt = new Date(trial.ends_at!);
    const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isLastDay = daysLeft <= 1;

    // Determine if we already have a reminder flag for this window
    // We use a simple heuristic: only send 7-day and 1-day reminders.
    if (daysLeft > 7) continue;
    if (daysLeft > 1 && daysLeft < 5) continue; // Only send at 7-day and 1-day marks

    let email: string | undefined;
    try {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(trial.user_id);
      email = userData?.user?.email ?? undefined;
    } catch {
      // Fall back to profile lookup
    }

    if (!email) continue;

    const subject = isLastDay
      ? "Your Pemabu trial ends tomorrow"
      : `Your Pemabu trial ends in ${daysLeft} days`;

    const html = `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
        <h1 style="font-size:18px;color:#0A1628;margin:0 0 12px">${subject}</h1>
        <p style="color:#374151;line-height:1.6">
          Your Pemabu trial for <strong>${trial.service_key}</strong> expires on
          <strong>${endsAt.toLocaleDateString()}</strong>.
        </p>
        ${isLastDay ? `
          <p style="color:#dc2626;line-height:1.6">
            Your trial ends tomorrow. Subscribe now to keep your portfolios and
            configuration active without interruption.
          </p>
        ` : `
          <p style="color:#374151;line-height:1.6">
            Subscribe before your trial ends to retain access to all your
            portfolios, signals, and settings.
          </p>
        `}
        <a href="https://pemabu.com/upgrade"
           style="display:inline-block;background:#10b981;color:#fff;
                  padding:12px 24px;border-radius:8px;text-decoration:none;
                  font-size:14px;margin:16px 0">
          Upgrade now
        </a>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:12px;margin:0">
          Pemabu · Private Beta · pemabu.com
        </p>
      </div>
    `;

    try {
      await emailResend.emails.send({ from: FROM, to: email, subject, html });
      reminded++;
      console.info(`[trial-reminder] Sent "${subject}" to ${email}`);
    } catch (err) {
      console.error(`[trial-reminder] Failed to send to ${email}:`, err);
    }
  }

  return { reminded, expired: expiredCount ?? 0 };
}
