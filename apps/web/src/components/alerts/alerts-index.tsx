"use client";

import { useMemo, useState } from "react";
import { BellRing, Building2, Search, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatDateTime } from "@/lib/formatters";
import { alertSeverityTone, titleCase } from "@/lib/presentation";
import { useAdminData } from "@/store/admin-data-provider";
import type { AlertSeverity, AlertType } from "@/types/domain";

export function AlertsIndex() {
  const { alerts, products, tenants } = useAdminData();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<AlertType | "all">("all");
  const [severity, setSeverity] = useState<AlertSeverity | "all">("all");
  const hasFilters = Boolean(query.trim()) || type !== "all" || severity !== "all";
  const tenantById = useMemo(
    () => new Map(tenants.map((tenant) => [tenant.id, tenant])),
    [tenants],
  );
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const filteredAlerts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return alerts.filter((alert) => {
      if (type !== "all" && alert.type !== type) return false;
      if (severity !== "all" && alert.severity !== severity) return false;
      const tenant = tenantById.get(alert.tenantId);
      const product = alert.productId ? productById.get(alert.productId) : undefined;
      return !normalized || [alert.title, alert.message, tenant?.name, product?.name]
        .some((value) => value?.toLocaleLowerCase().includes(normalized));
    });
  }, [alerts, productById, query, severity, tenantById, type]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Platform operations"
        title="Alerts"
        description="Operational signals across tenants, with severity and product context."
      />

      <section className="stat-grid stat-grid--three" aria-label="Alert summary">
        <StatCard label="Active alerts" value={`${alerts.length}`} helper="current signals" icon={<BellRing size={20} />} tone="amber" />
        <StatCard label="Critical" value={`${alerts.filter((item) => item.severity === "critical").length}`} helper="highest priority" icon={<ShieldAlert size={20} />} tone="red" />
        <StatCard label="Affected tenants" value={`${new Set(alerts.map((item) => item.tenantId)).size}`} helper="with an active signal" icon={<Building2 size={20} />} tone="blue" />
      </section>

      <Card>
        <div className="analytics-filters" aria-label="Alert filters">
          <label className="compact-select"><span>Search</span><span><Search size={15} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Alert, tenant, or product" /></span></label>
          <label className="compact-select"><span>Type</span><select value={type} onChange={(event) => setType(event.target.value as AlertType | "all")}><option value="all">All types</option><option value="spoilage">Spoilage</option><option value="low_stock">Low stock</option><option value="aging">Aging</option><option value="other">Other</option></select></label>
          <label className="compact-select"><span>Severity</span><select value={severity} onChange={(event) => setSeverity(event.target.value as AlertSeverity | "all")}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select></label>
          {hasFilters ? <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setType("all"); setSeverity("all"); }}>Clear filters</Button> : null}
        </div>

        {filteredAlerts.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Alert</th><th>Tenant</th><th>Product</th><th>Type</th><th>Severity</th><th>Created</th></tr></thead>
              <tbody>
                {filteredAlerts.map((alert) => (
                  <tr key={alert.id}>
                    <td><strong>{alert.title}</strong><small>{alert.message}</small></td>
                    <td>{tenantById.get(alert.tenantId)?.name ?? "Unknown tenant"}</td>
                    <td>{alert.productId ? productById.get(alert.productId)?.name ?? "Unknown product" : "—"}</td>
                    <td><Badge tone="info">{titleCase(alert.type)}</Badge></td>
                    <td><Badge tone={alertSeverityTone(alert.severity)}>{titleCase(alert.severity)}</Badge></td>
                    <td>{formatDateTime(alert.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<BellRing size={23} aria-hidden="true" />} title={alerts.length ? "No alerts match these filters" : "No active alerts"} description={alerts.length ? "Try a broader search or clear the filters." : "New operational signals will appear here."} action={hasFilters ? <Button variant="secondary" onClick={() => { setQuery(""); setType("all"); setSeverity("all"); }}>Clear filters</Button> : undefined} />
        )}
      </Card>
    </div>
  );
}
