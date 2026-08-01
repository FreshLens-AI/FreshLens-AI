"use server";

import { redirect } from "next/navigation";

import { parseAuthClaims } from "@/lib/auth/claims";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  message?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
  };
}

export async function loginAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fieldErrors: LoginState["fieldErrors"] = {};

  if (!email || !email.includes("@")) {
    fieldErrors.email = "Enter a valid administrator email.";
  }
  if (!password) fieldErrors.password = "Enter your password.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  if (!isSupabaseConfigured()) {
    return {
      message: "Authentication is not configured for this environment yet.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { message: "Incorrect email or password. Please try again." };
  }

  const { data, error: claimsError } = await supabase.auth.getClaims();
  const auth = claimsError ? null : parseAuthClaims(data?.claims);
  if (!auth || auth.role !== "platform_admin") {
    await supabase.auth.signOut({ scope: "local" });
    return {
      message:
        "This account does not have platform administrator access. Contact a FreshLens owner.",
    };
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/login");
}
