"use server";

import { revalidatePath } from "next/cache";

import { tenantApiFetch } from "@/lib/api/client";

export interface TeamActionState {
  status: "success" | "error" | null;
  message: string;
}

const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

async function apiError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({})) as { detail?: string };
  return body.detail || fallback;
}

export async function inviteVendor(
  _previous: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (displayName.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { status: "error", message: "Enter a name and valid email address." };
  }
  try {
    const response = await tenantApiFetch("api/v1/tenant/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName, email }),
    });
    if (!response.ok) return { status: "error", message: await apiError(response, "Could not invite this user.") };
  } catch {
    return { status: "error", message: "Could not reach the API. Please try again." };
  }
  revalidatePath("/workspace/team");
  return { status: "success", message: `Invitation emailed to ${email}.` };
}

export async function setVendorStatus(
  _previous: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const userId = String(formData.get("user_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!uuidPattern.test(userId) || (status !== "active" && status !== "inactive")) {
    return { status: "error", message: "Invalid access update." };
  }
  try {
    const response = await tenantApiFetch(`api/v1/tenant/users/${userId}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) return { status: "error", message: await apiError(response, "Could not update this user.") };
  } catch {
    return { status: "error", message: "Could not reach the API. Please try again." };
  }
  revalidatePath("/workspace/team");
  return { status: "success", message: status === "active" ? "User access restored." : "User access revoked." };
}
