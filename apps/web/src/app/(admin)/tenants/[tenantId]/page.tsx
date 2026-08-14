import { TenantDetail } from "@/components/tenants/tenant-detail";
import { listAdminTenants } from "@/lib/api/tenants";

interface TenantDetailPageProps {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ updated?: string | string[] }>;
}

export default async function TenantDetailPage({
  params,
  searchParams,
}: TenantDetailPageProps) {
  const [{ tenantId }, query] = await Promise.all([params, searchParams]);
  let liveTenant = null;
  try {
    const tenants = await listAdminTenants();
    liveTenant = tenants.find((row) => row.id === tenantId) ?? null;
  } catch {
    liveTenant = null;
  }

  return (
    <TenantDetail
      tenantId={tenantId}
      liveTenant={liveTenant}
      updated={query.updated === "1"}
    />
  );
}
