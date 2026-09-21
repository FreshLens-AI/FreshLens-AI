import { TenantDetail } from "@/components/tenants/tenant-detail";

interface TenantDetailPageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function TenantDetailPage({
  params,
}: TenantDetailPageProps) {
  const { tenantId } = await params;
  return <TenantDetail tenantId={tenantId} />;
}
