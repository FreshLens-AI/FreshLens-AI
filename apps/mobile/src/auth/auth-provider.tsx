import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Linking } from 'react-native';

import { parseVendorClaims, type VendorIdentity } from '../lib/auth/claims';
import { parsePasswordLink, PASSWORD_REDIRECT_URL } from '../lib/auth/password-link';
import {
  onSessionExpired,
  SESSION_EXPIRED_MESSAGE,
} from '../lib/auth/session-events';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'misconfigured' | 'password-setup';

interface AuthContextValue {
  status: AuthStatus;
  identity: VendorIdentity | null;
  message: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [identity, setIdentity] = useState<VendorIdentity | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const passwordSetup = useRef(false);

  const inspectSession = useCallback(async () => {
    if (passwordSetup.current) return null;
    const supabase = getSupabaseClient();
    let claimsResult;
    try {
      claimsResult = await supabase.auth.getClaims();
    } catch {
      setIdentity(null);
      setStatus('unauthenticated');
      setMessage(SESSION_EXPIRED_MESSAGE);
      return null;
    }

    const { data, error } = claimsResult;
    if (error || !data?.claims) {
      setIdentity(null);
      setStatus('unauthenticated');
      if (error && error.name !== 'AuthSessionMissingError') {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        setMessage(SESSION_EXPIRED_MESSAGE);
      }
      return null;
    }

    const vendor = parseVendorClaims(data.claims);
    if (!vendor) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      setIdentity(null);
      setStatus('unauthenticated');
      setMessage('This account is not provisioned for tenant mobile operations.');
      return null;
    }

    setMessage(null);
    setIdentity(vendor);
    setStatus('authenticated');
    return vendor;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStatus('misconfigured');
      return;
    }

    const supabase = getSupabaseClient();
    async function handlePasswordLink(url: string) {
      const link = parsePasswordLink(url);
      if (!link) return;
      if ('error' in link) {
        setStatus('unauthenticated');
        setMessage(link.error);
        return;
      }
      passwordSetup.current = true;
      setStatus('password-setup');
      setMessage(null);
      try {
        const { error } = await supabase.auth.setSession({
          access_token: link.accessToken,
          refresh_token: link.refreshToken,
        });
        if (error) throw error;
      } catch {
        passwordSetup.current = false;
        setStatus('unauthenticated');
        setMessage('This email link is invalid or expired. Request a new one.');
      }
    }
    const unsubscribeExpired = onSessionExpired((expiredMessage) => {
      passwordSetup.current = false;
      setIdentity(null);
      setMessage(expiredMessage);
      setStatus('unauthenticated');
    });
    void Linking.getInitialURL().then((url) => {
      if (url && parsePasswordLink(url)) void handlePasswordLink(url);
      else void inspectSession();
    }).catch(() => void inspectSession());
    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      void handlePasswordLink(url);
    });
    const { data } = supabase.auth.onAuthStateChange(() => {
      queueMicrotask(() => void inspectSession());
    });
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });

    return () => {
      data.subscription.unsubscribe();
      linkSubscription.remove();
      unsubscribeExpired();
      appStateSubscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, [inspectSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setMessage(null);
      const supabase = getSupabaseClient();
      let error;
      try {
        ({ error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        }));
      } catch {
        setMessage('Unable to reach authentication. Check your connection and try again.');
        return false;
      }
      if (error) {
        setMessage('Incorrect email or password. Please try again.');
        return false;
      }
      return Boolean(await inspectSession());
    },
    [inspectSession],
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      setIdentity(null);
      setMessage(null);
      setStatus('unauthenticated');
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    setMessage(null);
    try {
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
        email.trim().toLowerCase(), { redirectTo: PASSWORD_REDIRECT_URL },
      );
      if (error) throw error;
      return true;
    } catch {
      setMessage('Could not send the reset email. Please try again.');
      return false;
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const supabase = getSupabaseClient();
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    } catch {
      setMessage('Could not update your password. Request a new email link if it expired.');
      return false;
    }
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    passwordSetup.current = false;
    setIdentity(null);
    setStatus('unauthenticated');
    setMessage('Password saved. Sign in with your email and new password.');
    return true;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, identity, message, signIn, signOut, requestPasswordReset, updatePassword }),
    [identity, message, signIn, signOut, requestPasswordReset, updatePassword, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
