import type { ReactNode } from "react";

import { AdminShell } from "@/components/layout/admin-shell";
import { AdminDataProvider } from "@/store/admin-data-provider";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminDataProvider>
      <AdminShell>{children}</AdminShell>
    </AdminDataProvider>
  );
}
