import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapAdminData, mapAdminTenant, mapAdminTenantUser } from "./admin-map";

const tenant = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Example Grocer",
  status: "active" as const,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-02T00:00:00Z",
  last_active_at: "2026-08-03T00:00:00Z",
  primary_contact_name: "Example Vendor",
  primary_contact_email: "vendor@example.com",
  member_count: 2,
  catalogue_coverage: 3,
  scans_this_month: 10,
  fresh_scans_this_month: 6,
  medium_scans_this_month: 3,
  spoiled_scans_this_month: 1,
  active_alerts: 1,
};

describe("admin API mapping", () => {
  it("maps tenant counts into privacy-safe percentages", () => {
    const mapped = mapAdminTenant(tenant);
    assert.deepEqual(mapped.classificationMix, {
      fresh: 60,
      medium: 30,
      spoiled: 10,
    });
    assert.equal(mapped.spoilageRate, 10);
    assert.equal(mapped.completedClassifications, 10);
    assert.equal(mapped.ownerName, "Example Vendor");
    assert.equal(mapped.lastActiveAt, "2026-08-03T00:00:00Z");
  });

  it("preserves missing contact and activity without inventing values", () => {
    const mapped = mapAdminTenant({
      ...tenant,
      primary_contact_name: null,
      primary_contact_email: null,
      last_active_at: null,
      scans_this_month: 0,
      fresh_scans_this_month: 0,
      medium_scans_this_month: 0,
      spoiled_scans_this_month: 0,
    });
    assert.equal(mapped.ownerName, null);
    assert.equal(mapped.email, null);
    assert.equal(mapped.lastActiveAt, null);
    assert.equal(mapped.completedClassifications, 0);
    assert.deepEqual(mapped.classificationMix, { fresh: 0, medium: 0, spoiled: 0 });
  });

  it("maps tenant users and preserves their access status", () => {
    const mapped = mapAdminTenantUser({
      id: "11111111-1111-4111-8111-111111111501",
      tenant_id: tenant.id,
      display_name: "Team Member",
      email: "member@example.com",
      status: "inactive",
      created_at: "2026-08-04T00:00:00Z",
      updated_at: "2026-08-05T00:00:00Z",
    });
    assert.equal(mapped.tenantId, tenant.id);
    assert.equal(mapped.displayName, "Team Member");
    assert.equal(mapped.status, "inactive");
  });

  it("builds the complete web snapshot from admin responses", () => {
    const snapshot = mapAdminData(
      [tenant],
      [
        {
          id: "11111111-1111-4111-8111-111111111201",
          name: "Tomato",
          shelf_life_days: 5,
          fresh_to_medium_days: 2,
          medium_to_spoiled_days: 3,
          low_stock_threshold: 3,
          created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-02T00:00:00Z",
          scans_this_month: 8,
        },
      ],
      [
        {
          id: "11111111-1111-4111-8111-111111111401",
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          type: "aging",
          severity: "warning",
          message: "Tomato passed its shelf-life value.",
          product_id: "11111111-1111-4111-8111-111111111201",
          product_name: "Tomato",
          created_at: "2026-08-03T00:00:00Z",
        },
      ],
      {
        days: 90,
        tenant_id: null,
        trend: [
          { date: "2026-08-03", scans: 2, fresh: 1, medium: 1, spoiled: 0 },
        ],
        pipeline: [
          { status: "pending", count: 1 },
          { status: "processing", count: 0 },
          { status: "completed", count: 1 },
          { status: "failed", count: 0 },
        ],
      },
    );

    assert.equal(snapshot.tenants.length, 1);
    assert.equal(snapshot.products[0].freshToMediumDays, 2);
    assert.equal(snapshot.products[0].mediumToSpoiledDays, 3);
    assert.equal(snapshot.alerts[0].title, "Shelf-life alert · Tomato");
    assert.equal(snapshot.products[0].shelfLifeDays, 5);
    assert.equal(snapshot.trend[0].scans, 2);
    assert.equal(snapshot.pipelineSummary[0].helper, "Accepted and waiting for a worker");
  });
});
