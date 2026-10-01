import "server-only";

import { adminApiFetch } from "@/lib/api/client";

export interface TenantApplication {
  id: string;
  organization_name: string;
  applicant_name: string;
  applicant_email: string;
  phone: string | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  submitted_at: string;
}

export async function loadTenantApplications(status = "pending") {
  const response = await adminApiFetch(
    `api/v1/admin/tenant-applications?status=${encodeURIComponent(status)}&limit=100`,
  );
  if (!response.ok) throw new Error(`Could not load tenant applications (${response.status}).`);
  return (await response.json()) as {
    items: TenantApplication[];
    total: number;
  };
}
