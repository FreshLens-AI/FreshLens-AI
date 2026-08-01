import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { parseAuthClaims } from "@/lib/auth/claims";
import {
  getSupabasePublicConfig,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

const PUBLIC_PATHS = new Set([
  "/login",
  "/access-denied",
  "/session-expired",
]);

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      ({ name }) => name.startsWith("sb-") && name.includes("-auth-token"),
    );
}

function redirectWithSession(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
  reason?: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (reason) url.searchParams.set("reason", reason);
  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(header);
    if (value) redirectResponse.headers.set(header, value);
  }
  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.has(pathname);
  const hadAuthCookie = hasSupabaseAuthCookie(request);

  if (!isSupabaseConfigured()) {
    if (isPublicPath) return NextResponse.next({ request });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("configuration", "missing");
    return NextResponse.redirect(url);
  }

  const { url, publishableKey } = getSupabasePublicConfig();
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  // Keep this immediately after client creation so refresh-cookie state stays in sync.
  const { data } = await supabase.auth.getClaims();
  const auth = parseAuthClaims(data?.claims);

  if (!isPublicPath && !auth) {
    return redirectWithSession(
      request,
      supabaseResponse,
      "/login",
      hadAuthCookie ? "session-expired" : undefined,
    );
  }
  if (!isPublicPath && auth?.role !== "platform_admin") {
    return redirectWithSession(request, supabaseResponse, "/access-denied");
  }
  if (pathname === "/login" && auth?.role === "platform_admin") {
    return redirectWithSession(request, supabaseResponse, "/dashboard");
  }

  return supabaseResponse;
}
