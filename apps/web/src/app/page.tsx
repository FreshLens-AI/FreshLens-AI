import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");
  if (auth.role === "platform_admin") redirect("/dashboard");
  if (auth.role === "tenant_admin") redirect("/workspace");
  redirect("/access-denied");
}
