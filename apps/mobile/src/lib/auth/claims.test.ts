/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseVendorClaims } from './claims';

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SESSION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const AUTHENTICATED_IDENTITY = {
  sub: USER_ID,
  role: 'authenticated',
  is_anonymous: false,
  session_id: SESSION_ID,
} as const;

describe('parseVendorClaims', () => {
  it('accepts a signed vendor identity with tenant context', () => {
    assert.deepEqual(
      parseVendorClaims({
        ...AUTHENTICATED_IDENTITY,
        app_role: 'vendor',
        tenant_id: TENANT_ID,
        email: 'vendor@example.com',
      }),
      {
        userId: USER_ID,
        tenantId: TENANT_ID,
        email: 'vendor@example.com',
      },
    );
  });

  it('rejects missing or malformed tenant context', () => {
    assert.equal(
      parseVendorClaims({ ...AUTHENTICATED_IDENTITY, app_role: 'vendor' }),
      null,
    );
    assert.equal(
      parseVendorClaims({
        ...AUTHENTICATED_IDENTITY,
        app_role: 'vendor',
        tenant_id: 'not-a-uuid',
      }),
      null,
    );
  });

  it('rejects admin, anonymous, and malformed identities', () => {
    assert.equal(
      parseVendorClaims({
        ...AUTHENTICATED_IDENTITY,
        app_role: 'platform_admin',
        tenant_id: TENANT_ID,
      }),
      null,
    );
    assert.equal(
      parseVendorClaims({
        ...AUTHENTICATED_IDENTITY,
        app_role: 'vendor',
        tenant_id: TENANT_ID,
        is_anonymous: true,
      }),
      null,
    );
    assert.equal(
      parseVendorClaims({
        ...AUTHENTICATED_IDENTITY,
        sub: 'not-a-uuid',
        app_role: 'vendor',
        tenant_id: TENANT_ID,
      }),
      null,
    );
  });

  it('requires a standard authenticated user session', () => {
    assert.equal(
      parseVendorClaims({
        ...AUTHENTICATED_IDENTITY,
        role: 'service_role',
        app_role: 'vendor',
        tenant_id: TENANT_ID,
      }),
      null,
    );
    assert.equal(
      parseVendorClaims({
        sub: USER_ID,
        app_role: 'vendor',
        tenant_id: TENANT_ID,
        session_id: SESSION_ID,
      }),
      null,
    );
    assert.equal(
      parseVendorClaims({
        ...AUTHENTICATED_IDENTITY,
        session_id: 'not-a-uuid',
        app_role: 'vendor',
        tenant_id: TENANT_ID,
      }),
      null,
    );
  });

  it('ignores user metadata role and tenant values', () => {
    assert.equal(
      parseVendorClaims({
        ...AUTHENTICATED_IDENTITY,
        app_role: 'platform_admin',
        user_metadata: { app_role: 'vendor', tenant_id: TENANT_ID },
      }),
      null,
    );
  });
});
