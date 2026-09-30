"use server";

import { revalidatePath } from "next/cache";

import { adminApiFetch } from "@/lib/api/client";

export interface CreateTenantState {
  status: "success" | "error" | null;
  message: string;
}

export async function createTenant(
  _previous: CreateTenantState,
  formData: FormData,
): Promise<CreateTenantState> {
  const name = String(formData.get("name") ?? "").trim();
  const vendorName = String(formData.get("vendor_name") ?? "").trim();
  const vendorEmail = String(formData.get("vendor_email") ?? "").trim().toLowerCase();
  if (!name || !vendorName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(vendorEmail)) {
    return { status: "error", message: "Enter a tenant name, contact name, and valid email." };
  }
  try {
    const response = await adminApiFetch("api/v1/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, vendor_name: vendorName, vendor_email: vendorEmail }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { detail?: string };
      return {
        status: "error",
        message: body.detail || `Could not create the tenant (${response.status}).`,
      };
    }
  } catch {
    return { status: "error", message: "Could not reach the API. Please try again." };
  }
  revalidatePath("/tenants");
  return { status: "success", message: `Tenant created. An invitation was emailed to ${vendorEmail}.` };
}
