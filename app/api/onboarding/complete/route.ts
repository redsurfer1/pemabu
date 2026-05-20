import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const Schema = z.object({
  stepReached: z.number().int().min(0).max(3),
  completed: z.boolean(),
});

export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({
      onboarding_completed: parsed.data.completed,
      onboarding_completed_at: parsed.data.completed ? new Date().toISOString() : null,
      onboarding_step_reached: parsed.data.stepReached,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) throw error;
  return NextResponse.json({ success: true });
});
