/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  mapPasswordResetError,
  mapSignInError,
  passwordResetHelpCopy,
  passwordResetSuccessMessage,
  vendorNotProvisionedMessage,
} from './sign-in-errors';

describe('mapSignInError', () => {
  it('defaults to incorrect credentials', () => {
    assert.match(mapSignInError(null), /Incorrect email or password/);
    assert.match(mapSignInError({ message: 'Invalid login credentials' }), /Incorrect/);
  });

  it('maps rate limits and network failures', () => {
    assert.match(
      mapSignInError({ code: 'over_request_rate_limit', status: 429 }),
      /Too many/,
    );
    assert.match(mapSignInError({ message: 'Failed to fetch', status: 0 }), /connection/);
  });

  it('maps confirmation and disabled accounts', () => {
    assert.match(
      mapSignInError({ code: 'email_not_confirmed' }),
      /Confirm your email/,
    );
    assert.match(mapSignInError({ message: 'User is banned' }), /disabled/);
  });
});

describe('password reset copy', () => {
  it('keeps V1 owner-provisioned guidance', () => {
    assert.match(vendorNotProvisionedMessage(), /store admin/);
    assert.match(passwordResetHelpCopy(), /no self-signup/);
    assert.match(passwordResetSuccessMessage(), /reset link|temporary password/i);
    assert.match(mapPasswordResetError({ status: 500 }), /connection/);
  });
});
