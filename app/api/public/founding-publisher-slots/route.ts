import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabaseAdmin
    .from("founding_publisher_stats")
    .select("total_founding_publishers, slots_remaining, is_full")
    .single();

  if (error) {
    return NextResponse.json(
      { total: 0, remaining: 50, isFull: false },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  }

  return NextResponse.json(
    {
      total: Number(data.total_founding_publishers ?? 0),
      remaining: Number(data.slots_remaining ?? 50),
      isFull: Boolean(data.is_full),
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
