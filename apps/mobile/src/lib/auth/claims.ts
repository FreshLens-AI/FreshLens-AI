export interface VendorIdentity {
  userId: string;
  tenantId: string;
  role: 'vendor' | 'tenant_admin';
  email: string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseVendorClaims(claims: unknown): VendorIdentity | null {
  if (!claims || typeof claims !== 'object') return null;
  const payload = claims as Record<string, unknown>;
  const userId = typeof payload.sub === 'string' ? payload.sub : '';
  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : '';
  const tenantId = typeof payload.tenant_id === 'string' ? payload.tenant_id : '';

  if (payload.role !== 'authenticated' || payload.is_anonymous !== false) return null;
  if (payload.app_role !== 'vendor' && payload.app_role !== 'tenant_admin') return null;
  if (
    !UUID_PATTERN.test(userId) ||
    !UUID_PATTERN.test(sessionId) ||
    !UUID_PATTERN.test(tenantId)
  ) {
    return null;
  }

  return {
    userId,
    tenantId,
    role: payload.app_role,
    email: typeof payload.email === 'string' ? payload.email : null,
  };
}
