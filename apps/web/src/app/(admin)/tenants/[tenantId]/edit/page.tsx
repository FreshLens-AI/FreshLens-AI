import { TenantEditForm } from "@/components/tenants/tenant-edit-form";

interface TenantEditPageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function TenantEditPage({ params }: TenantEditPageProps) {
  const { tenantId } = await params;

  return <TenantEditForm tenantId={tenantId} />;
}
