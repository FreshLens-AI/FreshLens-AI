import type { ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { AdminShell } from "@/components/layout/admin-shell";
import { loadAdminData } from "@/lib/api/admin-data";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { AdminDataProvider } from "@/store/admin-data-provider";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requirePlatformAdmin();
  let initialData;
  try {
    initialData = await loadAdminData();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Admin data unavailable", error);
    return (
      <main className="standalone-state" role="alert">
        <div className="standalone-state__mark"><TriangleAlert size={25} /></div>
        <p className="eyebrow">Workspace unavailable</p>
        <h1>We couldn&apos;t load live admin data.</h1>
        <p>Check that the FreshLens API is running, then reload the workspace.</p>
        <a href="/dashboard" className="button button--primary button--md">Reload workspace</a>
      </main>
    );
  }

  return (
    <AdminDataProvider initialData={initialData}>
      <AdminShell
        admin={{ displayName: admin.displayName, email: admin.email }}
      >
        {children}
      </AdminShell>
    </AdminDataProvider>
  );
}
