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
    if (error.code === "over_request_rate_limit") {
      return { message: "Too many sign-in attempts. Please try again later." };
    }
    if (error.code === "email_not_confirmed") {
      return { message: "Confirm your email before signing in." };
    }
    if (error.code !== "invalid_credentials") {
      return { message: "Sign-in is temporarily unavailable. Please try again shortly." };
    }
    return { message: "Incorrect email or password. Please try again." };
  }

  const { data, error: claimsError } = await supabase.auth.getClaims();
  const auth = claimsError ? null : parseAuthClaims(data?.claims);
  if (!auth || auth.role === "vendor") {
    await supabase.auth.signOut({ scope: "local" });
    return {
      message:
        "Vendor accounts use the FreshLens mobile app. Contact your tenant administrator if you need help.",
    };
  }

  redirect(auth.role === "platform_admin" ? "/dashboard" : "/workspace");
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/login");
}
