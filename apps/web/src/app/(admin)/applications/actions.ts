"use server";

import { revalidatePath } from "next/cache";

import { adminApiFetch } from "@/lib/api/client";

export interface ReviewState {
  status: "success" | "error" | null;
  message: string;
}

const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

async function reviewApplication(
  decision: "approve" | "reject",
  _previous: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const applicationId = String(formData.get("application_id") ?? "");
  if (!uuidPattern.test(applicationId)) {
    return { status: "error", message: "Invalid application." };
  }
  try {
    const response = await adminApiFetch(
      `api/v1/admin/tenant-applications/${applicationId}/${decision}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: null }),
      },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { detail?: string };
      return { status: "error", message: body.detail || `Could not ${decision} this application.` };
    }
  } catch {
    return { status: "error", message: "Could not reach the API. Please try again." };
  }
  revalidatePath("/applications");
  revalidatePath("/tenants");
  return {
    status: "success",
    message: decision === "approve" ? "Tenant created and owner invitation sent." : "Application rejected.",
  };
}

export async function approveApplication(previous: ReviewState, formData: FormData) {
  return reviewApplication("approve", previous, formData);
}

export async function rejectApplication(previous: ReviewState, formData: FormData) {
  return reviewApplication("reject", previous, formData);
}
