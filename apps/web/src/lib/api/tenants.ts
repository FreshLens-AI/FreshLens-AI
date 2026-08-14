import "server-only";

import { adminApiFetch } from "@/lib/api/client";
import type { LiveTenant } from "@/lib/api/tenant-map";

export type { LiveTenant };

export async function listAdminTenants(): Promise<LiveTenant[]> {
  const response = await adminApiFetch("api/v1/admin/tenants?limit=100");
  if (!response.ok) {
    throw new Error(`Failed to load tenants (${response.status}).`);
  }
  const body = (await response.json()) as { items: LiveTenant[] };
  return body.items ?? [];
}
