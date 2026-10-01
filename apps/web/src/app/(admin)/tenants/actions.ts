"use server";

import { revalidatePath } from "next/cache";

import { adminApiFetch } from "@/lib/api/client";

export interface CreateTenantState {
  status: "success" | "error" | null;
  message: string;
}

export type AccessMutationState = CreateTenantState;

const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

async function apiError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({})) as { detail?: string };
  return body.detail || fallback;
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

export async function inviteTenantUser(
  _previous: AccessMutationState,
  formData: FormData,
): Promise<AccessMutationState> {
  const tenantId = String(formData.get("tenant_id") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!uuidPattern.test(tenantId) || !displayName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { status: "error", message: "Enter a name and valid email address." };
  }
  try {
    const response = await adminApiFetch(`api/v1/admin/tenants/${tenantId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName, email }),
    });
    if (!response.ok) {
      return {
        status: "error",
        message: await apiError(response, `Could not invite the user (${response.status}).`),
      };
    }
  } catch {
    return { status: "error", message: "Could not reach the API. Please try again." };
  }
  revalidatePath(`/tenants/${tenantId}`);
  revalidatePath("/tenants");
  return { status: "success", message: `Invitation emailed to ${email}.` };
}

export async function setTenantStatus(
  _previous: AccessMutationState,
  formData: FormData,
): Promise<AccessMutationState> {
  const tenantId = String(formData.get("tenant_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!uuidPattern.test(tenantId) || (status !== "active" && status !== "inactive")) {
    return { status: "error", message: "Invalid tenant access update." };
  }
  try {
    const response = await adminApiFetch(`api/v1/admin/tenants/${tenantId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      return {
        status: "error",
        message: await apiError(response, `Could not update tenant access (${response.status}).`),
      };
    }
  } catch {
    return { status: "error", message: "Could not reach the API. Please try again." };
  }
  revalidatePath(`/tenants/${tenantId}`);
  revalidatePath("/tenants");
  return {
    status: "success",
    message: status === "active" ? "Tenant access restored." : "Tenant access revoked for all users.",
  };
}

export async function setTenantUserStatus(
  _previous: AccessMutationState,
  formData: FormData,
): Promise<AccessMutationState> {
  const tenantId = String(formData.get("tenant_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!uuidPattern.test(tenantId) || !uuidPattern.test(userId) ||
      (status !== "active" && status !== "inactive")) {
    return { status: "error", message: "Invalid user access update." };
  }
  try {
    const response = await adminApiFetch(
      `api/v1/admin/tenants/${tenantId}/users/${userId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    if (!response.ok) {
      return {
        status: "error",
        message: await apiError(response, `Could not update user access (${response.status}).`),
      };
    }
  } catch {
    return { status: "error", message: "Could not reach the API. Please try again." };
  }
  revalidatePath(`/tenants/${tenantId}`);
  return {
    status: "success",
    message: status === "active" ? "User access restored." : "User access revoked.",
  };
}
