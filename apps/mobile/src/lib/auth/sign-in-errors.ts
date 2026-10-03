/** Map Supabase Auth errors to vendor-facing copy (no public signup in V1). */

const NOT_PROVISIONED =
  'This account is not provisioned for the vendor mobile app. Ask your store admin to finish setup, then sign in again.';

const BAD_CREDENTIALS =
  'Incorrect email or password. Check the temporary password from your admin, then try again.';

const NETWORK =
  'Unable to reach authentication. Check your connection and try again.';

const RATE_LIMITED =
  'Too many sign-in attempts. Wait a minute, then try again.';

export function vendorNotProvisionedMessage(): string {
  return NOT_PROVISIONED;
}

export function mapSignInError(error: {
  message?: string;
  status?: number;
  code?: string;
} | null): string {
  if (!error) return BAD_CREDENTIALS;

  const code = (error.code ?? '').toLowerCase();
  const message = (error.message ?? '').toLowerCase();
  const status = error.status ?? 0;

  if (
    code === 'over_request_rate_limit' ||
    message.includes('rate limit') ||
    status === 429
  ) {
    return RATE_LIMITED;
  }

  if (
    code === 'email_not_confirmed' ||
    message.includes('email not confirmed')
  ) {
    return 'Confirm your email using the link from your admin before signing in.';
  }

  if (
    code === 'user_banned' ||
    message.includes('banned') ||
    message.includes('disabled')
  ) {
    return 'This account is disabled. Contact your store admin.';
  }

  if (
    status >= 500 ||
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('failed to fetch')
  ) {
    return NETWORK;
  }

  return BAD_CREDENTIALS;
}

export function mapPasswordResetError(error: {
  message?: string;
  status?: number;
  code?: string;
} | null): string {
  if (!error) {
    return 'If that email is registered, a reset link is on the way. Otherwise ask your admin to set a new temporary password.';
  }

  const message = (error.message ?? '').toLowerCase();
  const status = error.status ?? 0;

  if (status >= 500 || message.includes('fetch') || message.includes('network')) {
    return NETWORK;
  }

  if (status === 429 || message.includes('rate limit')) {
    return RATE_LIMITED;
  }

  return 'Could not send a reset email. Ask your store admin to set a temporary password instead.';
}

export function passwordResetSuccessMessage(): string {
  return 'If that email is registered, a reset link is on the way. Check your inbox, or ask your admin for a temporary password.';
}

export function passwordResetHelpCopy(): string {
  return 'FreshLens accounts are created by your store admin. There is no self-signup. Ask them for a temporary password, or send a reset email if your address is already registered.';
}
