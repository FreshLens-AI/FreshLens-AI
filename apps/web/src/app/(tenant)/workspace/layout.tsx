import type { ReactNode } from "react";

import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { requireTenantAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function TenantLayout({ children }: { children: ReactNode }) {
  const owner = await requireTenantAdmin();
  return <WorkspaceShell owner={{ displayName: owner.displayName, email: owner.email }}>{children}</WorkspaceShell>;
}
