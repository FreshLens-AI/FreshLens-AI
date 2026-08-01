import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseAuthClaims } from "./claims";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SESSION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const AUTHENTICATED_IDENTITY = {
  sub: USER_ID,
  role: "authenticated",
  is_anonymous: false,
  session_id: SESSION_ID,
} as const;

describe("parseAuthClaims", () => {
  it("accepts a platform admin without tenant context", () => {
    assert.deepEqual(
      parseAuthClaims({
        ...AUTHENTICATED_IDENTITY,
        app_role: "platform_admin",
        email: "admin@example.com",
      }),
      {
        userId: USER_ID,
        role: "platform_admin",
        tenantId: null,
        email: "admin@example.com",
        displayName: "admin",
      },
    );
  });

  it("accepts a vendor only with a valid tenant", () => {
    assert.equal(
      parseAuthClaims({
        ...AUTHENTICATED_IDENTITY,
        app_role: "vendor",
        tenant_id: TENANT_ID,
      })?.tenantId,
      TENANT_ID,
    );
    assert.equal(
      parseAuthClaims({ ...AUTHENTICATED_IDENTITY, app_role: "vendor" }),
      null,
    );
  });

  it("rejects unknown, anonymous, and malformed identities", () => {
    assert.equal(
      parseAuthClaims({
        ...AUTHENTICATED_IDENTITY,
        app_role: "authenticated",
      }),
      null,
    );
    assert.equal(
      parseAuthClaims({
        ...AUTHENTICATED_IDENTITY,
        app_role: "platform_admin",
        is_anonymous: true,
      }),
      null,
    );
    assert.equal(
      parseAuthClaims({
        ...AUTHENTICATED_IDENTITY,
        sub: "not-a-uuid",
        app_role: "platform_admin",
      }),
      null,
    );
  });

  it("requires a standard authenticated user session", () => {
    assert.equal(
      parseAuthClaims({
        ...AUTHENTICATED_IDENTITY,
        role: "service_role",
        app_role: "platform_admin",
      }),
      null,
    );
    assert.equal(
      parseAuthClaims({
        sub: USER_ID,
        app_role: "platform_admin",
        session_id: SESSION_ID,
      }),
      null,
    );
    assert.equal(
      parseAuthClaims({
        ...AUTHENTICATED_IDENTITY,
        session_id: "not-a-uuid",
        app_role: "platform_admin",
      }),
      null,
    );
  });

  it("rejects an admin token carrying vendor tenant context", () => {
    assert.equal(
      parseAuthClaims({
        ...AUTHENTICATED_IDENTITY,
        app_role: "platform_admin",
        tenant_id: TENANT_ID,
      }),
      null,
    );
  });

  it("uses user metadata only for presentation", () => {
    const auth = parseAuthClaims({
      ...AUTHENTICATED_IDENTITY,
      app_role: "platform_admin",
      user_metadata: {
        app_role: "vendor",
        tenant_id: TENANT_ID,
        display_name: "  Operations Lead  ",
      },
    });

    assert.equal(auth?.role, "platform_admin");
    assert.equal(auth?.tenantId, null);
    assert.equal(auth?.displayName, "Operations Lead");
  });
});
