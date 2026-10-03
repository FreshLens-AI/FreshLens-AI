import type { AsyncStringStore } from './chunked-storage';

const REMEMBERED_EMAIL_KEY = 'freshlens.auth.remembered_email';
const ONBOARDING_PREFIX = 'freshlens.onboarding.dismissed.';

export function createAuthPreferences(store: AsyncStringStore) {
  return {
    async getRememberedEmail(): Promise<string | null> {
      const value = await store.getItemAsync(REMEMBERED_EMAIL_KEY);
      if (!value) return null;
      const trimmed = value.trim().toLowerCase();
      return trimmed.includes('@') ? trimmed : null;
    },

    async setRememberedEmail(email: string | null): Promise<void> {
      if (!email) {
        await store.deleteItemAsync(REMEMBERED_EMAIL_KEY);
        return;
      }
      const trimmed = email.trim().toLowerCase();
      if (!trimmed.includes('@')) {
        await store.deleteItemAsync(REMEMBERED_EMAIL_KEY);
        return;
      }
      await store.setItemAsync(REMEMBERED_EMAIL_KEY, trimmed);
    },

    async isOnboardingDismissed(userId: string): Promise<boolean> {
      if (!userId) return true;
      const value = await store.getItemAsync(`${ONBOARDING_PREFIX}${userId}`);
      return value === '1';
    },

    async dismissOnboarding(userId: string): Promise<void> {
      if (!userId) return;
      await store.setItemAsync(`${ONBOARDING_PREFIX}${userId}`, '1');
    },
  };
}

export type AuthPreferences = ReturnType<typeof createAuthPreferences>;
