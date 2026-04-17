// lib/services/email.ts
// Resend email service.
// SERVER-ONLY: never import from client components.

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@pemabu.com";
const OPERATOR = process.env.OPERATOR_ALERT_EMAIL ?? "";

// ── Operator alerts ──────────────────────────────────

export async function alertOperator(subject: string, body: string): Promise<void> {
  if (!OPERATOR) {
    console.error("OPERATOR_ALERT_EMAIL not set — cannot send alert");
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: OPERATOR,
    subject: `[Pemabu Ops] ${subject}`,
    text: body,
  });
}

// ── User weekly brief ────────────────────────────────

export async function sendWeeklyBrief(input: {
  toEmail: string;
  portfolioName: string;
  briefText: string;
}): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to: input.toEmail,
    subject: `Your weekly portfolio brief — ${input.portfolioName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;
        margin:0 auto;padding:24px">
        <p style="color:#10b981;font-size:12px;
          letter-spacing:0.1em;text-transform:uppercase;
          margin:0 0 8px">ALLOCATION INTELLIGENCE</p>
        <h1 style="font-size:20px;margin:0 0 16px;
          color:#0A1628">
          ${input.portfolioName} — Weekly Brief
        </h1>
        <p style="color:#374151;line-height:1.6;
          white-space:pre-line">
          ${input.briefText}
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;
          margin:24px 0"/>
        <p style="color:#9ca3af;font-size:12px;margin:0">
          Pemabu · Private Beta ·
          <a href="https://pemabu.com"
            style="color:#10b981">pemabu.com</a>
        </p>
      </div>
    `,
  });
}
