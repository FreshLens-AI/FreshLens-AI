import { TenantDetail } from "@/components/tenants/tenant-detail";
import { loadTenantPage, loadTenantUsers } from "@/lib/api/admin-data";
import { AdminDataProvider } from "@/store/admin-data-provider";
import { notFound } from "next/navigation";

interface TenantDetailPageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function TenantDetailPage({
  params,
}: TenantDetailPageProps) {
  const { tenantId } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(tenantId)) notFound();
  const tenants = await loadTenantPage(1, "", undefined, tenantId);
  if (!tenants.items.length) notFound();
  const users = await loadTenantUsers(tenantId);
  return <AdminDataProvider initialData={{ tenants: tenants.items, products: [], alerts: [], trend: [], pipelineSummary: [] }}>
    <TenantDetail tenantId={tenantId} users={users} />
  </AdminDataProvider>;
}
