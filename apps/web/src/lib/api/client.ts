import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { requirePlatformAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function getApiUrl() {
  // Prefer direct upstream on the server to avoid a self-proxy hop when
  // NEXT_PUBLIC_API_URL points at this Vercel app (rewrite front door).
  const apiUrl =
    process.env.API_UPSTREAM_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!apiUrl) {
    throw new Error(
      "API_UPSTREAM_URL or NEXT_PUBLIC_API_URL must be configured for the admin app.",
    );
  }
  return apiUrl.replace(/\/$/, "");
}

function requireFreshSession(): never {
  // A Route Handler performs the cookie mutation; server render code cannot.
  redirect("/session-expired");
}

const getAdminAccessToken = cache(async () => {
  await requirePlatformAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (error || !accessToken) requireFreshSession();
  return accessToken;
});

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
  const accessToken = await getAdminAccessToken();

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
