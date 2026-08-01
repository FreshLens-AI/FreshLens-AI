import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import { parseAuthClaims } from "./claims";

export const getAuthContext = cache(async () => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return parseAuthClaims(data.claims);
});

export async function requirePlatformAdmin() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");
  if (auth.role !== "platform_admin") redirect("/access-denied");
  return auth;
}
