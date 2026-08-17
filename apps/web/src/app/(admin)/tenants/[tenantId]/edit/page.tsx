import { redirect } from "next/navigation";

interface TenantEditPageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function TenantEditPage({ params }: TenantEditPageProps) {
  const { tenantId } = await params;
  redirect(`/tenants/${tenantId}`);
}
