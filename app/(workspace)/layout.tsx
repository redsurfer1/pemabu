import { WorkspaceChrome } from "@/components/navigation/WorkspaceChrome";
import { requireWorkspaceUser } from "@/lib/navigation/workspace-auth";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireWorkspaceUser();
  return (
    <WorkspaceChrome userId={user.id} userEmail={user.email}>
      {children}
    </WorkspaceChrome>
  );
}
