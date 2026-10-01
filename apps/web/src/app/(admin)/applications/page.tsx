import type { Metadata } from "next";

import { ApplicationQueue } from "@/components/applications/application-queue";
import { PageHeader } from "@/components/ui/page-header";
import { loadTenantApplications } from "@/lib/api/applications";

export const metadata: Metadata = { title: "Tenant applications" };

export default async function ApplicationsPage() {
  const applications = await loadTenantApplications();
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Onboarding"
        title="Tenant applications"
        description="Approve verified organizations to create their tenant workspace and invite the first tenant administrator."
      />
      <ApplicationQueue applications={applications.items} />
    </div>
  );
}
