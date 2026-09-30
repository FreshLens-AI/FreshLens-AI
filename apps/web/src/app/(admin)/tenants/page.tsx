import { TenantList } from "@/components/tenants/tenant-list";
import { loadTenantPage } from "@/lib/api/admin-data";

export default async function TenantsPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const status = params.status === "active" || params.status === "inactive" ? params.status : undefined;
  const page = Number(params.page) || 1;
  const result = await loadTenantPage(page, search, status);
  return <TenantList result={result} search={search} status={status ?? "all"} />;
}
