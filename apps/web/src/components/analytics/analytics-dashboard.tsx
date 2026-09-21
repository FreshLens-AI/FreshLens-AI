"use client";

import { Activity, ScanLine, ShieldCheck, TriangleAlert } from "lucide-react";

import { ClassificationStack, TrendChart } from "@/components/analytics/trend-chart";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatNumber, formatPercent, initials } from "@/lib/formatters";
import { useAdminData } from "@/store/admin-data-provider";

export function AnalyticsDashboard() {
  const { tenants, trend } = useAdminData();
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
      <PageHeader eyebrow="Platform intelligence" title="Analytics" description="Live 90-day classification and adoption aggregates from the admin API." />
      <section className="stat-grid" aria-label="Analytics summary">
        <StatCard label="Accepted scans" value={formatNumber(scans)} helper="last 90 days" icon={<ScanLine size={21} />} />
        <StatCard label="Fresh signals" value={formatPercent(mix.fresh, 0)} helper={`${formatNumber(freshCount)} classifications`} icon={<ShieldCheck size={21} />} tone="blue" />
        <StatCard label="Spoiled signals" value={formatPercent(mix.spoiled, 0)} helper={`${formatNumber(spoiledCount)} classifications`} icon={<TriangleAlert size={21} />} tone="red" />
        <StatCard label="Active tenants" value={`${tenants.filter((item) => item.status === "active").length}`} helper="contributing aggregates" icon={<Activity size={21} />} tone="amber" />
      </section>
      <section className="dashboard-main-grid">
        <Card className="chart-card"><CardHeader title="Classification throughput" description="All tenants · last 90 days" /><TrendChart data={trend} /></Card>
        <Card className="classification-card"><CardHeader title="Classification distribution" description="Fresh, Medium, and Spoiled only" /><div className="analytics-big-number"><strong>{formatNumber(completed)}</strong><span>completed classifications</span></div><ClassificationStack {...mix} /></Card>
      </section>
      <Card>
        <CardHeader title="Tenant comparison" description="Current-month privacy-safe aggregates" />
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tenant</th><th>Monthly scans</th><th>Fresh</th><th>Medium</th><th>Spoiled</th><th>Active alerts</th></tr></thead>
            <tbody>{tenants.map((tenant) => <tr key={tenant.id}><td><div className="entity-cell"><span className="entity-avatar">{initials(tenant.name)}</span><div><strong>{tenant.name}</strong><small>{tenant.ownerName}</small></div></div></td><td>{formatNumber(tenant.scansThisMonth)}</td><td>{tenant.classificationMix.fresh}%</td><td>{tenant.classificationMix.medium}%</td><td>{tenant.classificationMix.spoiled}%</td><td>{tenant.activeAlerts}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
