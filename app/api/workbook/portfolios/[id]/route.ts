import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { MUTATION_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { getPortfolio, updatePortfolio, deletePortfolio } from "@/lib/services/portfolio";
import type { Portfolio } from "@/lib/types/database";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  currency: z.enum(["USD", "GBP", "EUR", "CAD", "AUD"]).optional(),
});

async function verifyOwnership(portfolioId: string, userId: string) {
  const portfolio = await getPortfolio(portfolioId);
  if (!portfolio) return null;
  if (portfolio.user_id !== userId) return null;
  return portfolio;
}

export const GET = withAuth(async (req, user, ctx) => {
  const { id: idParam } = await ctx.params;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  if (!id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const portfolio = await verifyOwnership(id, user.id);
  if (!portfolio) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ portfolio });
});

export const PATCH = withAuth(async (req, user, ctx) => {
  const { id: idParam } = await ctx.params;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  if (!id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const portfolio = await verifyOwnership(id, user.id);
  if (!portfolio) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, description, currency } = parsed.data;
  const patch: Partial<Pick<Portfolio, "name" | "description" | "currency">> = {};
  if (name !== undefined) patch.name = name;
  if (description !== undefined) {
    patch.description = description === "" ? null : description;
  }
  if (currency !== undefined) patch.currency = currency;
  const updated = await updatePortfolio(id, patch);
  return NextResponse.json({ portfolio: updated });
}, { keyTemplate: "portfolios:{userId}", ...MUTATION_RATE_LIMIT });

export const DELETE = withAuth(async (req, user, ctx) => {
  const { id: idParam } = await ctx.params;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  if (!id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const portfolio = await verifyOwnership(id, user.id);
  if (!portfolio) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await deletePortfolio(id);
  return NextResponse.json({ success: true });
}, { keyTemplate: "portfolios:{userId}", ...MUTATION_RATE_LIMIT });
