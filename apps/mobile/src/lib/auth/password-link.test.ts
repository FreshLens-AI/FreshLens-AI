import assert from 'node:assert/strict';
import { it } from 'node:test';

import { parsePasswordLink } from './password-link';

it('accepts invite and recovery links with session tokens', () => {
  assert.deepEqual(
    parsePasswordLink('freshlens://set-password#access_token=abc&refresh_token=xyz&type=invite'),
    { accessToken: 'abc', refreshToken: 'xyz' },
  );
  assert.deepEqual(
    parsePasswordLink('freshlens://set-password#access_token=abc&refresh_token=xyz&type=recovery'),
    { accessToken: 'abc', refreshToken: 'xyz' },
  );
});

it('rejects unrelated or expired links', () => {
  assert.equal(parsePasswordLink('freshlens://other#access_token=abc&refresh_token=xyz'), null);
  assert.deepEqual(parsePasswordLink('freshlens://set-password#error=access_denied'), {
    error: 'This email link is invalid or expired. Request a new one.',
  });
});
