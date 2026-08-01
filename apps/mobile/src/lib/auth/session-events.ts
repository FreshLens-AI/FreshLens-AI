export const SESSION_EXPIRED_MESSAGE =
  'Your session has expired or is no longer valid. Sign in again to continue.';

type SessionExpiredListener = (message: string) => void;

const listeners = new Set<SessionExpiredListener>();

export function reportSessionExpired(message = SESSION_EXPIRED_MESSAGE) {
  listeners.forEach((listener) => listener(message));
}

export function onSessionExpired(listener: SessionExpiredListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
