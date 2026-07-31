"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Info,
  ScanLine,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { ClassificationStack, TrendChart } from "@/components/analytics/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { platformTrend, tenantAggregates } from "@/data/mock-data";
import { formatNumber, formatPercent, initials } from "@/lib/formatters";
import { useAdminData } from "@/store/admin-data-provider";
import type { TrendPoint } from "@/types/domain";

type Period = "7d" | "30d" | "90d";

export function AnalyticsDashboard() {
  const { tenants } = useAdminData();
  const [period, setPeriod] = useState<Period>("30d");
  const [tenantId, setTenantId] = useState("all");
  const selectedTenant = tenants.find((tenant) => tenant.id === tenantId);

  const data = useMemo(() => {
    const source = period === "7d" ? platformTrend.slice(-7) : platformTrend;
    if (!selectedTenant) return source;
    const platformScans = tenants.reduce((sum, tenant) => sum + tenant.scansThisMonth, 0);
    const share = selectedTenant.scansThisMonth / Math.max(platformScans, 1);
    return source.map<TrendPoint>((point) => ({
      ...point,
      scans: Math.max(1, Math.round(point.scans * share)),
      fresh: Math.round(point.scans * share * selectedTenant.classificationMix.fresh / 100),
      medium: Math.round(point.scans * share * selectedTenant.classificationMix.medium / 100),
      spoiled: Math.round(point.scans * share * selectedTenant.classificationMix.spoiled / 100),
    }));
  }, [period, selectedTenant, tenants]);

  const scans = data.reduce((sum, item) => sum + item.scans, 0);
  const freshCount = data.reduce((sum, item) => sum + item.fresh, 0);
  const mediumCount = data.reduce((sum, item) => sum + item.medium, 0);
  const spoiledCount = data.reduce((sum, item) => sum + item.spoiled, 0);
  const completed = Math.max(freshCount + mediumCount + spoiledCount, 1);
  const mix = {
    fresh: Math.round((freshCount / completed) * 100),
    medium: Math.round((mediumCount / completed) * 100),
    spoiled: 0,
  };
  mix.spoiled = Math.max(0, 100 - mix.fresh - mix.medium);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Platform intelligence"
        title="Analytics"
        description="Explore aggregated classification and adoption signals without exposing tenant-private scans or inventory records."
      />

      <div className="analytics-filters" aria-label="Analytics filters">
        <div className="segmented-control" aria-label="Date range">
          {(["7d", "30d", "90d"] as Period[]).map((value) => (
            <button key={value} className={period === value ? "is-active" : ""} onClick={() => setPeriod(value)}>{value === "7d" ? "7 days" : value === "30d" ? "30 days" : "90 days"}</button>
          ))}
        </div>
        <label className="compact-select">
          <span>Tenant aggregate</span>
          <select value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
            <option value="all">All tenants</option>
            {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
          </select>
        </label>
      </div>

      <section className="stat-grid" aria-label="Analytics summary">
        <StatCard label="Accepted scans" value={formatNumber(scans)} helper={`${period === "7d" ? "last 7 days" : period === "30d" ? "representative 30-day view" : "representative 90-day view"}`} icon={<ScanLine size={21} />} trend={{ value: "12.4%", direction: "up" }} />
        <StatCard label="Fresh signals" value={formatPercent(mix.fresh, 0)} helper="of completed results" icon={<ShieldCheck size={21} />} tone="blue" trend={{ value: "2.1 pts", direction: "up" }} />
        <StatCard label="Spoiled signals" value={formatPercent(mix.spoiled, 0)} helper={`${formatNumber(spoiledCount)} classifications`} icon={<TriangleAlert size={21} />} tone="red" trend={{ value: "0.8 pts", direction: "down", positive: true }} />
        <StatCard label="Active tenants" value={`${tenants.filter((item) => item.status === "active").length}`} helper="contributing aggregates" icon={<Activity size={21} />} tone="amber" />
      </section>

      <section className="dashboard-main-grid">
        <Card className="chart-card">
          <CardHeader title="Classification throughput" description={`${selectedTenant?.name ?? "All tenants"} · aggregate accepted scans`} action={<Badge tone="info">{period === "7d" ? "7-day view" : period === "30d" ? "30-day view" : "90-day view"}</Badge>} />
          <TrendChart data={data} />
        </Card>
        <Card className="classification-card">
          <CardHeader title="Classification distribution" description="Fresh, Medium, and Spoiled only" />
          <div className="analytics-big-number"><strong>{formatNumber(completed)}</strong><span>completed classifications</span></div>
          <ClassificationStack {...mix} />
          <div className="analytics-delta-grid">
            <div><ArrowUpRight size={17} /><span>Fresh</span><strong>{formatNumber(freshCount)}</strong></div>
            <div><BarChart3 size={17} /><span>Medium</span><strong>{formatNumber(mediumCount)}</strong></div>
            <div><ArrowDownRight size={17} /><span>Spoiled</span><strong>{formatNumber(spoiledCount)}</strong></div>
          </div>
        </Card>
      </section>

      <section className="dashboard-main-grid">
        <Card className="chart-card">
          <CardHeader title="Spoilage signal trend" description="Count of completed classifications labelled Spoiled" />
          <TrendChart data={data} mode="spoiled" />
        </Card>
        <Card>
          <CardHeader title="What this view means" description="A careful interpretation of demo analytics" />
          <div className="insight-list">
            <div><span className="insight-list__icon"><ShieldCheck size={18} /></span><div><strong>Privacy-first aggregation</strong><p>No produce image, quantity, batch, or individual scan record is shown.</p></div></div>
            <div><span className="insight-list__icon insight-list__icon--amber"><TriangleAlert size={18} /></span><div><strong>Spoilage signal, not waste</strong><p>A Spoiled classification is not evidence that stock was discarded.</p></div></div>
            <div><span className="insight-list__icon insight-list__icon--blue"><Info size={18} /></span><div><strong>Demo data</strong><p>Filters exercise the intended UI using representative local fixtures.</p></div></div>
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader title="Tenant comparison" description="Aggregate classification mix and alert signals" />
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tenant</th><th>Monthly scans</th><th>Fresh</th><th>Medium</th><th>Spoiled</th><th>Active alerts</th></tr></thead>
            <tbody>
              {tenantAggregates.map((row) => {
                const tenant = tenants.find((item) => item.id === row.tenantId);
                if (!tenant) return null;
                return (
                  <tr key={row.tenantId}>
                    <td><div className="entity-cell"><span className="entity-avatar">{initials(tenant.name)}</span><div><strong>{tenant.name}</strong><small>{tenant.city}</small></div></div></td>
                    <td>{formatNumber(row.scans)}</td>
                    <td><span className="classification-value classification-value--fresh">{row.fresh}%</span></td>
                    <td><span className="classification-value classification-value--medium">{row.medium}%</span></td>
                    <td><span className="classification-value classification-value--spoiled">{row.spoiled}%</span></td>
                    <td>{row.activeAlerts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
