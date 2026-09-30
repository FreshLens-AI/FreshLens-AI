const SET_PASSWORD_URL = 'freshlens://set-password';

export function parsePasswordLink(url: string):
  | { accessToken: string; refreshToken: string }
  | { error: string }
  | null {
  const [base, fragment = ''] = url.split('#', 2);
  if (base.split('?')[0] !== SET_PASSWORD_URL) return null;
  const params = new URLSearchParams(fragment);
  if (params.has('error')) {
    return { error: 'This email link is invalid or expired. Request a new one.' };
  }
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) {
    return { error: 'This email link is invalid or expired. Request a new one.' };
  }
  return { accessToken, refreshToken };
}

export const PASSWORD_REDIRECT_URL = SET_PASSWORD_URL;
