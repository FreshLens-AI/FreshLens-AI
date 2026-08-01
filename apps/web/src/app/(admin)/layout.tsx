import type { ReactNode } from "react";

import { AdminShell } from "@/components/layout/admin-shell";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { AdminDataProvider } from "@/store/admin-data-provider";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requirePlatformAdmin();

  return (
    <AdminDataProvider>
      <AdminShell
        admin={{ displayName: admin.displayName, email: admin.email }}
      >
        {children}
      </AdminShell>
    </AdminDataProvider>
  );
}
