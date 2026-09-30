import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { loadAdminAnalytics, loadAdminOverview, loadTenantPage } from "@/lib/api/admin-data";
import { AdminDataProvider } from "@/store/admin-data-provider";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: {
  searchParams: Promise<{ days?: string; tenant?: string }>;
}) {
  const params = await searchParams;
  const days = [7, 30, 90].includes(Number(params.days)) ? Number(params.days) : 90;
  const tenantId = typeof params.tenant === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(params.tenant) ? params.tenant : undefined;
  const [analytics, tenants, selected, overview] = await Promise.all([
    loadAdminAnalytics(days, tenantId),
    loadTenantPage(1, "", undefined, undefined, 100),
    tenantId ? loadTenantPage(1, "", undefined, tenantId) : Promise.resolve(null),
    loadAdminOverview(),
  ]);
  const selectedTenant = selected?.items[0];
  if (tenantId && !selectedTenant) {
    redirect(`/analytics?days=${days}`);
  }
  const options = selectedTenant && !tenants.items.some((tenant) => tenant.id === selectedTenant.id)
    ? [selectedTenant, ...tenants.items]
    : tenants.items;
  return <AdminDataProvider initialData={{ ...analytics, tenants: tenantId ? selected?.items ?? [] : tenants.items }}>
    <AnalyticsDashboard days={days} tenantId={tenantId} tenantOptions={options} tenantTotal={tenants.total} overview={overview} />
  </AdminDataProvider>;
}
