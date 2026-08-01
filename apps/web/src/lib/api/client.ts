import "server-only";

import { redirect } from "next/navigation";

import { requirePlatformAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function getApiUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured for the admin app.");
  }
  return apiUrl.replace(/\/$/, "");
}

function requireFreshSession(): never {
  // A Route Handler performs the cookie mutation; server render code cannot.
  redirect("/session-expired");
}

/**
 * Call FastAPI from trusted server code with a verified platform-admin token.
 *
 * `getSession()` is deliberately used only after `requirePlatformAdmin()` has
 * verified the signed claims. Its result supplies the raw token for forwarding;
 * it is never an authorization decision.
 */
export async function adminApiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  await requirePlatformAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (error || !accessToken) requireFreshSession();

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(
    `${getApiUrl()}/${path.replace(/^\/+/, "")}`,
    {
      cache: "no-store",
      ...init,
      headers,
    },
  );

  if (response.status === 401) requireFreshSession();
  return response;
}
