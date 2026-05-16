import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { requireWorkspaceUser } from "@/lib/navigation/workspace-auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireWorkspaceUser();
  return (
    <DashboardPageShell userId={user.id} userEmail={user.email}>
      {children}
    </DashboardPageShell>
  );
}
