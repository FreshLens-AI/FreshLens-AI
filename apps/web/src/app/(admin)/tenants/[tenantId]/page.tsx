import { TenantDetail } from "@/components/tenants/tenant-detail";

interface TenantDetailPageProps {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ updated?: string | string[] }>;
}

export default async function TenantDetailPage({
  params,
  searchParams,
}: TenantDetailPageProps) {
  const [{ tenantId }, query] = await Promise.all([params, searchParams]);

  return <TenantDetail tenantId={tenantId} updated={query.updated === "1"} />;
}
