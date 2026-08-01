import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("reason", "session-expired");
  return NextResponse.redirect(loginUrl);
}
