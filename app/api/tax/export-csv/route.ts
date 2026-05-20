import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getBaseUrl } from "@/lib/app-url";
import type { TaxLot, TaxSummary } from "@/app/api/tax/form-8949/route";

// Returns a Form 8949 CSV file for download.
// Column order matches TurboTax import specification:
// Description, Date Acquired, Date Sold, Proceeds, Cost Basis,
// Adjustment Code, Adjustment Amount, Gain or Loss, Term

export const GET = withAuth(async (req, user) => {
  const url = new URL(req.url);
  const year = url.searchParams.get("year") ?? String(new Date().getFullYear());

  // Verify Autonomous tier access
  const { data: sub } = await supabaseAdmin
    .from("user_subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .eq("service_key", "autonomous_annual")
    .maybeSingle();

  const hasAccess =
    sub?.status === "active" ||
    sub?.status === "complimentary" ||
    sub?.status === "trial";

  if (!hasAccess) {
    return new Response("Autonomous subscription required", { status: 403 });
  }

  // Fetch from the JSON endpoint by forwarding the same cookies
  const base = getBaseUrl();
  const dataRes = await fetch(`${base}/api/tax/form-8949?year=${year}`, {
    headers: { cookie: req.headers.get("cookie") ?? "" },
  });

  if (!dataRes.ok) {
    return new Response("Failed to fetch tax data", { status: 500 });
  }

  const { taxLots, summary } = (await dataRes.json()) as {
    taxLots: TaxLot[];
    summary: TaxSummary;
  };

  // Form 8949 CSV — TurboTax column order (verified against TurboTax import spec)
  const headers = [
    "Description",
    "Date Acquired",
    "Date Sold",
    "Proceeds",
    "Cost Basis",
    "Adjustment Code",
    "Adjustment Amount",
    "Gain or Loss",
    "Term",
  ].join(",");

  const rows = taxLots.map((lot) =>
    [
      `"${lot.description}"`,
      lot.date_acquired,
      lot.date_sold,
      lot.proceeds.toFixed(2),
      lot.cost_basis.toFixed(2),
      "", // Adjustment Code (blank = none)
      "", // Adjustment Amount (blank = none)
      lot.gain_loss.toFixed(2),
      lot.holding_period === "LONG" ? "Long" : "Short",
    ].join(","),
  );

  const verificationNote = summary.requiresVerification
    ? "# IMPORTANT: Some rows have $0.00 proceeds — verify actual sale proceeds from your broker statement before filing."
    : "# All proceeds sourced from Pemabu execution logs.";

  const csv = [
    `# Pemabu Tax Export — Form 8949 — Tax Year ${summary.year}`,
    `# Generated: ${new Date().toISOString()}`,
    `# NOT A TAX DOCUMENT — For informational purposes only. Verify with a qualified tax professional.`,
    verificationNote,
    "",
    headers,
    ...rows,
  ].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="pemabu-form-8949-${summary.year}.csv"`,
    },
  });
});
