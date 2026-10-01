import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { TeamManagement } from "@/components/workspace/team-management";
import { loadTenantUsers } from "@/lib/api/tenant-data";

export const metadata: Metadata = { title: "Tenant team" };

export default async function TeamPage() {
  const users = await loadTenantUsers();
  return <div className="page-stack"><PageHeader eyebrow="Tenant administration" title="Team access" description="Invite vendor users and control individual access without exposing another tenant." /><TeamManagement users={users} /></div>;
}
