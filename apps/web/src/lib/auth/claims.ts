export type AppRole = "vendor" | "platform_admin";

export interface AuthContext {
  userId: string;
  role: AppRole;
  tenantId: string | null;
  email: string | null;
  displayName: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export function parseAuthClaims(claims: unknown): AuthContext | null {
  const payload = record(claims);
  if (!payload || payload.is_anonymous === true) return null;

  const userId = typeof payload.sub === "string" ? payload.sub : "";
  const sessionId =
    typeof payload.session_id === "string" ? payload.session_id : "";
  const role = payload.app_role;
  const tenantId =
    typeof payload.tenant_id === "string" ? payload.tenant_id : null;

  if (payload.role !== "authenticated" || payload.is_anonymous !== false) {
    return null;
  }
  if (!UUID_PATTERN.test(userId) || !UUID_PATTERN.test(sessionId)) return null;
  if (role !== "vendor" && role !== "platform_admin") return null;
  if (role === "vendor" && (!tenantId || !UUID_PATTERN.test(tenantId))) {
    return null;
  }
  if (role === "platform_admin" && tenantId !== null) return null;

  const email = typeof payload.email === "string" ? payload.email : null;
  const metadata = record(payload.user_metadata);
  const metadataName =
    metadata && typeof metadata.display_name === "string"
      ? metadata.display_name.trim()
      : "";
  const displayName =
    metadataName || email?.split("@")[0] || "Platform administrator";

  return { userId, role, tenantId, email, displayName };
}
