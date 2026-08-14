import { TenantList } from "@/components/tenants/tenant-list";
import { listAdminTenants } from "@/lib/api/tenants";

export default async function TenantsPage() {
  let liveTenants: Awaited<ReturnType<typeof listAdminTenants>> = [];
  let loadError: string | null = null;
  try {
    liveTenants = await listAdminTenants();
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Could not load tenants from the API.";
  }

  return <TenantList liveTenants={liveTenants} loadError={loadError} />;
}
