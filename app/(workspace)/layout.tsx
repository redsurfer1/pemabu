import { WorkspaceChrome } from "@/components/navigation/WorkspaceChrome";
import { requireWorkspaceUser } from "@/lib/navigation/workspace-auth";
import { DemoModeWrapper } from "@/components/demo/DemoModeWrapper";
import { ErrorBoundaryClient } from "@/components/shared/ErrorBoundaryClient";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireWorkspaceUser();
  return (
    <DemoModeWrapper>
      <WorkspaceChrome userId={user.id} userEmail={user.email}>
        <ErrorBoundaryClient>{children}</ErrorBoundaryClient>
      </WorkspaceChrome>
    </DemoModeWrapper>
  );
}
