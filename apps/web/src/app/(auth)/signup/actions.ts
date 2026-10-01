"use server";

import { publicApiFetch } from "@/lib/api/client";

export interface SignupState {
  status: "success" | "error" | null;
  message: string;
  fieldErrors?: Partial<Record<"organization" | "name" | "email" | "phone", string>>;
}

export async function submitTenantApplication(
  _previous: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const organization = String(formData.get("organization") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const fieldErrors: SignupState["fieldErrors"] = {};

  if (organization.length < 2) fieldErrors.organization = "Enter your store or organization name.";
  if (name.length < 2) fieldErrors.name = "Enter the tenant owner's name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (phone && phone.length < 5) fieldErrors.phone = "Enter a valid phone number or leave it blank.";
  if (Object.keys(fieldErrors).length) {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors };
  }

  try {
    const response = await publicApiFetch("api/v1/tenant-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organization_name: organization,
        applicant_name: name,
        applicant_email: email,
        phone: phone || null,
      }),
    });
    if (!response.ok) {
      return { status: "error", message: "We could not submit your application. Please try again." };
    }
  } catch {
    return { status: "error", message: "FreshLens is temporarily unavailable. Please try again shortly." };
  }

  return {
    status: "success",
    message: "Application received. A platform administrator will review it and email you if it is approved.",
  };
}
