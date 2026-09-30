"use client";

import Link from "next/link";
import { BellRing, Building2, Search, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ListPagination } from "@/components/ui/list-pagination";
import { StatCard } from "@/components/ui/stat-card";
import { formatDateTime } from "@/lib/formatters";
import { alertSeverityTone, titleCase } from "@/lib/presentation";
import type { AdminOverview, ListPage } from "@/lib/api/admin-data";
import type { Alert, AlertSeverity, AlertType } from "@/types/domain";

export function AlertsIndex({ result, overview, search, type, severity }: {
  result: ListPage<Alert>;
  overview: AdminOverview;
  search: string;
  type: AlertType | "all";
  severity: AlertSeverity | "all";
}) {
  const hasFilters = Boolean(search) || type !== "all" || severity !== "all";

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Platform operations"
        title="Alerts"
        description="Operational signals across tenants, with severity and product context."
      />

      <section className="stat-grid stat-grid--three" aria-label="Alert summary">
        <StatCard label="Active alerts" value={`${overview.active_alerts}`} helper="current signals" icon={<BellRing size={20} />} tone="amber" />
        <StatCard label="Critical" value={`${overview.critical_alerts}`} helper="highest priority" icon={<ShieldAlert size={20} />} tone="red" />
        <StatCard label="Affected tenants" value={`${overview.affected_tenants}`} helper="with an active signal" icon={<Building2 size={20} />} tone="blue" />
      </section>

      <Card>
        <form action="/alerts" method="get" className="analytics-filters" aria-label="Alert filters">
          <label className="compact-select"><span>Search</span><span><Search size={15} aria-hidden="true" /><input type="search" name="q" defaultValue={search} placeholder="Alert, tenant, or product" /></span></label>
          <label className="compact-select"><span>Type</span><select name="type" defaultValue={type}><option value="all">All types</option><option value="spoilage">Spoilage</option><option value="low_stock">Low stock</option><option value="aging">Aging</option><option value="other">Other</option></select></label>
          <label className="compact-select"><span>Severity</span><select name="severity" defaultValue={severity}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select></label>
          <Button type="submit" variant="secondary" size="sm">Apply filters</Button>
          {hasFilters ? <Link href="/alerts" className="text-link">Clear filters</Link> : null}
        </form>

        {result.items.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Alert</th><th>Tenant</th><th>Product</th><th>Type</th><th>Severity</th><th>Created</th></tr></thead>
              <tbody>
                {result.items.map((alert) => (
                  <tr key={alert.id}>
                    <td><strong>{alert.title}</strong><small>{alert.message}</small></td>
                    <td>{alert.tenantName ?? "Unknown tenant"}</td>
                    <td>{alert.productId ? alert.productName ?? "Unknown product" : "—"}</td>
                    <td><Badge tone="info">{titleCase(alert.type)}</Badge></td>
                    <td><Badge tone={alertSeverityTone(alert.severity)}>{titleCase(alert.severity)}</Badge></td>
                    <td>{formatDateTime(alert.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<BellRing size={23} aria-hidden="true" />} title={hasFilters ? "No alerts match these filters" : "No active alerts"} description={hasFilters ? "Try a broader search or clear the filters." : "New operational signals will appear here."} action={hasFilters ? <Button href="/alerts" variant="secondary">Clear filters</Button> : undefined} />
        )}
        <ListPagination path="/alerts" page={result.page} pageSize={result.pageSize} total={result.total} filters={{ q: search, type: type === "all" ? undefined : type, severity: severity === "all" ? undefined : severity }} />
      </Card>
    </div>
  );
}
