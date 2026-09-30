import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { requirePlatformAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requirePlatformAdmin();
  return (
    <AdminShell admin={{ displayName: admin.displayName, email: admin.email }}>
      {children}
    </AdminShell>
  );
}
