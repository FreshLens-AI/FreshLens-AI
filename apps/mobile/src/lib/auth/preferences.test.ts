/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AsyncStringStore } from './chunked-storage';
import { createAuthPreferences } from './preferences';

function memoryStore(): AsyncStringStore {
  const map = new Map<string, string>();
  return {
    async getItemAsync(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    async setItemAsync(key, value) {
      map.set(key, value);
    },
    async deleteItemAsync(key) {
      map.delete(key);
    },
  };
}

describe('createAuthPreferences', () => {
  it('remembers and clears a normalized vendor email', async () => {
    const prefs = createAuthPreferences(memoryStore());
    await prefs.setRememberedEmail('  Vendor@Example.COM ');
    assert.equal(await prefs.getRememberedEmail(), 'vendor@example.com');
    await prefs.setRememberedEmail(null);
    assert.equal(await prefs.getRememberedEmail(), null);
  });

  it('tracks per-user onboarding dismissal', async () => {
    const prefs = createAuthPreferences(memoryStore());
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    assert.equal(await prefs.isOnboardingDismissed(userId), false);
    await prefs.dismissOnboarding(userId);
    assert.equal(await prefs.isOnboardingDismissed(userId), true);
  });
});
