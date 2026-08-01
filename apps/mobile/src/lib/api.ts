import { parseVendorClaims } from './auth/claims';
import { reportSessionExpired } from './auth/session-events';
import { getSupabaseClient } from './supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export async function apiFetch(path: string, init: RequestInit = {}) {
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is not configured.');

  const supabase = getSupabaseClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !parseVendorClaims(claimsData?.claims)) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    reportSessionExpired();
    throw new Error('A valid vendor session is required.');
  }

  const { data, error: sessionError } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (sessionError || !accessToken) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    reportSessionExpired();
    throw new Error('A valid vendor session is required.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, {
    ...init,
    headers,
  });
  if (response.status === 401) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    reportSessionExpired();
  }
  return response;
}
