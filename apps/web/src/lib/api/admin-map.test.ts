import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapAdminData, mapAdminTenant } from "./admin-map";

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
    assert.equal(mapped.ownerName, "Example Vendor");
    assert.equal(mapped.lastActiveAt, "2026-08-03T00:00:00Z");
  });

  it("builds the complete web snapshot from admin responses", () => {
    const snapshot = mapAdminData(
      [tenant],
      [
        {
          id: "11111111-1111-4111-8111-111111111201",
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          name: "Tomato",
          shelf_life_days: 5,
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
    assert.equal(snapshot.products[0].tenantName, "Example Grocer");
    assert.equal(snapshot.alerts[0].title, "Shelf-life alert · Tomato");
    assert.equal(snapshot.shelfLifeRules[0].defaultDays, 5);
    assert.equal(snapshot.trend[0].scans, 2);
    assert.equal(snapshot.pipelineSummary[0].helper, "Accepted and waiting for a worker");
  });
});
