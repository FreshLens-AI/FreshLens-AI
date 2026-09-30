"use client";

import Link from "next/link";
import { Activity, ScanLine, ShieldCheck, TriangleAlert } from "lucide-react";

import { ClassificationStack, TrendChart } from "@/components/analytics/trend-chart";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatNumber, formatPercent, initials } from "@/lib/formatters";
import { useAdminData } from "@/store/admin-data-provider";
import type { AdminOverview } from "@/lib/api/admin-data";
import type { Tenant } from "@/types/domain";

export function AnalyticsDashboard({ days, tenantId, tenantOptions, tenantTotal, overview }: {
  days: number;
  tenantId?: string;
  tenantOptions: Tenant[];
  tenantTotal: number;
  overview: AdminOverview;
}) {
  const { tenants, trend } = useAdminData();
  const selectedName = tenantId ? tenantOptions.find((tenant) => tenant.id === tenantId)?.name ?? "Selected tenant" : "All tenants";
  const scans = trend.reduce((sum, item) => sum + item.scans, 0);
  const freshCount = trend.reduce((sum, item) => sum + item.fresh, 0);
  const mediumCount = trend.reduce((sum, item) => sum + item.medium, 0);
  const spoiledCount = trend.reduce((sum, item) => sum + item.spoiled, 0);
  const completed = freshCount + mediumCount + spoiledCount;
  const mix = {
    fresh: completed ? Math.round((freshCount / completed) * 100) : 0,
    medium: completed ? Math.round((mediumCount / completed) * 100) : 0,
    spoiled: 0,
  };
  mix.spoiled = completed ? Math.max(0, 100 - mix.fresh - mix.medium) : 0;

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Platform intelligence" title="Analytics" description="Live classification and adoption aggregates from the admin API." />
      <form action="/analytics" method="get" className="analytics-filters card" aria-label="Analytics filters">
        <label className="compact-select"><span>Date range</span><select name="days" defaultValue={days}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
        <label className="compact-select"><span>Tenant</span><select name="tenant" defaultValue={tenantId ?? ""}><option value="">All tenants</option>{tenantOptions.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></label>
        <button type="submit" className="button button--secondary button--md">Apply filters</button>
        {tenantTotal > 100 ? <span className="context-note">Showing the first 100 tenants. <Link href="/tenants" className="text-link">Find another tenant</Link></span> : null}
      </form>
      <section className="stat-grid" aria-label="Analytics summary">
        <StatCard label="Accepted scans" value={formatNumber(scans)} helper={`last ${days} days`} icon={<ScanLine size={21} />} />
        <StatCard label="Fresh signals" value={completed ? formatPercent(mix.fresh, 0) : "—"} helper={`${formatNumber(freshCount)} classifications`} icon={<ShieldCheck size={21} />} tone="blue" />
        <StatCard label="Spoiled signals" value={completed ? formatPercent(mix.spoiled, 0) : "—"} helper={`${formatNumber(spoiledCount)} classifications`} icon={<TriangleAlert size={21} />} tone="red" />
        <StatCard label={tenantId ? "Tenant status" : "Active tenants"} value={tenantId ? (tenants[0]?.status === "active" ? "Active" : "Inactive") : `${overview.active_tenants}`} helper={tenantId ? selectedName : "active on platform"} icon={<Activity size={21} />} tone="amber" />
      </section>
      <section className="dashboard-main-grid">
        <Card className="chart-card"><CardHeader title="Classification throughput" description={`${selectedName} · last ${days} days`} /><TrendChart data={trend} /></Card>
        <Card className="classification-card"><CardHeader title="Classification distribution" description="Fresh, Medium, and Spoiled only" /><div className="analytics-big-number"><strong>{formatNumber(completed)}</strong><span>completed classifications</span></div>{completed ? <ClassificationStack {...mix} /> : <EmptyState icon={<Activity size={22} />} title="No classifications yet" description="Distribution appears when scans complete." />}</Card>
      </section>
      <Card>
        <CardHeader title={tenantId ? "Tenant summary" : "Tenant comparison"} description="Current-month privacy-safe aggregates" />
        {tenants.length ? <div className="table-wrap">
          <table>
            <thead><tr><th>Tenant</th><th>Monthly scans</th><th>Fresh</th><th>Medium</th><th>Spoiled</th><th>Active alerts</th></tr></thead>
            <tbody>{tenants.slice(0, 20).map((tenant) => <tr key={tenant.id}><td><div className="entity-cell"><span className="entity-avatar">{initials(tenant.name)}</span><div><strong>{tenant.name}</strong><small>{tenant.ownerName ?? "No contact listed"}</small></div></div></td><td>{formatNumber(tenant.scansThisMonth)}</td><td>{tenant.completedClassifications ? `${tenant.classificationMix.fresh}%` : "—"}</td><td>{tenant.completedClassifications ? `${tenant.classificationMix.medium}%` : "—"}</td><td>{tenant.completedClassifications ? `${tenant.classificationMix.spoiled}%` : "—"}</td><td>{tenant.activeAlerts}</td></tr>)}</tbody>
          </table>
        </div> : <EmptyState icon={<Activity size={22} />} title="No tenant activity yet" description="Tenant comparisons appear after organizations are provisioned." />}
        {!tenantId && tenantTotal > 20 ? <p className="context-note">Showing 20 of {formatNumber(tenantTotal)} tenants. <Link href="/tenants" className="text-link">View all tenants</Link></p> : null}
      </Card>
    </div>
  );
}
