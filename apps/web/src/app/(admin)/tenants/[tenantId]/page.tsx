import { TenantDetail } from "@/components/tenants/tenant-detail";
import { loadProductPage, loadTenantPage } from "@/lib/api/admin-data";
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
  const [tenants, products] = await Promise.all([
    loadTenantPage(1, "", undefined, tenantId),
    loadProductPage(1, "", tenantId, undefined, 100),
  ]);
  if (!tenants.items.length) notFound();
  return <AdminDataProvider initialData={{ tenants: tenants.items, products: products.items, alerts: [], trend: [], pipelineSummary: [] }}>
    <TenantDetail tenantId={tenantId} productTotal={products.total} />
  </AdminDataProvider>;
}
