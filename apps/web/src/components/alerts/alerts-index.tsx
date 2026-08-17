"use client";

import { useMemo, useState } from "react";
import { BellRing, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/formatters";
import { alertSeverityTone, titleCase } from "@/lib/presentation";
import { useAdminData } from "@/store/admin-data-provider";
import type { AlertSeverity, AlertType } from "@/types/domain";

export function AlertsIndex() {
  const { alerts, products, tenants } = useAdminData();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<AlertType | "all">("all");
  const [severity, setSeverity] = useState<AlertSeverity | "all">("all");
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
        description="Live tenant alert signals from the API without scan images, quantities, or batch identifiers."
      />

      <section className="stat-grid" aria-label="Alert summary">
        <Card><CardHeader title="Active alerts" /><strong>{alerts.length}</strong><p>All persisted V1 alerts are active signals.</p></Card>
        <Card><CardHeader title="Critical" /><strong>{alerts.filter((item) => item.severity === "critical").length}</strong><p>Critical signals requiring review.</p></Card>
        <Card><CardHeader title="Aging" /><strong>{alerts.filter((item) => item.type === "aging").length}</strong><p>Static shelf-life alerts.</p></Card>
        <Card><CardHeader title="Low stock" /><strong>{alerts.filter((item) => item.type === "low_stock").length}</strong><p>Vendor threshold signals.</p></Card>
      </section>

      <Card>
        <div className="analytics-filters" aria-label="Alert filters">
          <label className="compact-select"><span>Search</span><span><Search size={15} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Alert, tenant, or product" /></span></label>
          <label className="compact-select"><span>Type</span><select value={type} onChange={(event) => setType(event.target.value as AlertType | "all")}><option value="all">All types</option><option value="spoilage">Spoilage</option><option value="low_stock">Low stock</option><option value="aging">Aging</option><option value="other">Other</option></select></label>
          <label className="compact-select"><span>Severity</span><select value={severity} onChange={(event) => setSeverity(event.target.value as AlertSeverity | "all")}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select></label>
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
          <EmptyState icon={<BellRing size={23} aria-hidden="true" />} title={alerts.length ? "No alerts match these filters" : "No alerts recorded"} description={alerts.length ? "Try a broader search or filter." : "Live alerts will appear here when vendors generate them."} />
        )}
      </Card>
    </div>
  );
}
