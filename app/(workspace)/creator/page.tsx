import { redirect } from "next/navigation";

// /creator redirects to /creator/dashboard (canonical creator analytics URL)
export default function CreatorRootPage() {
  redirect("/creator/dashboard");
}
