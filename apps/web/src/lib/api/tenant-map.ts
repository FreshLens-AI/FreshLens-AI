import type { Tenant } from "@/types/domain";

export type LiveTenant = {
  id: string;
  name: string;
  created_at: string;
};

const emptyMix = { fresh: 0, medium: 0, spoiled: 0 };

export function liveTenantToAdminTenant(
  row: LiveTenant,
  extras?: Tenant,
): Tenant {
  if (extras) {
    return {
      ...extras,
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
    };
  }
  return {
    id: row.id,
    name: row.name,
    ownerName: "—",
    email: "—",
    phone: "—",
    city: "—",
    status: "active",
    plan: "Pilot",
    createdAt: row.created_at,
    lastActiveAt: row.created_at,
    memberCount: 0,
    catalogueCoverage: 0,
    scansThisMonth: 0,
    spoilageRate: 0,
    classificationMix: emptyMix,
    activeAlerts: 0,
  };
}
