import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SleevesPageClient } from "./SleevesPageClient";

export default async function SleevesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  return <SleevesPageClient userId={user.id} />;
}
