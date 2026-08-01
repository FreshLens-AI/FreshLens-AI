import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { parseVendorClaims, type VendorIdentity } from '../lib/auth/claims';
import {
  onSessionExpired,
  SESSION_EXPIRED_MESSAGE,
} from '../lib/auth/session-events';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'misconfigured';

interface AuthContextValue {
  status: AuthStatus;
  identity: VendorIdentity | null;
  message: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [identity, setIdentity] = useState<VendorIdentity | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const inspectSession = useCallback(async () => {
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
      setMessage('This account is not provisioned for the vendor mobile app.');
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
    const unsubscribeExpired = onSessionExpired((expiredMessage) => {
      setIdentity(null);
      setMessage(expiredMessage);
      setStatus('unauthenticated');
    });
    void inspectSession();
    const { data } = supabase.auth.onAuthStateChange(() => {
      queueMicrotask(() => void inspectSession());
    });
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });

    return () => {
      data.subscription.unsubscribe();
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

  const value = useMemo<AuthContextValue>(
    () => ({ status, identity, message, signIn, signOut }),
    [identity, message, signIn, signOut, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
