import type { Metadata } from "next";
import { Leaf, ScanLine, TriangleAlert } from "lucide-react";

import { ClassificationStack, TrendChart } from "@/components/analytics/trend-chart";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { loadTenantAnalytics } from "@/lib/api/tenant-data";
import { formatNumber } from "@/lib/formatters";

export const metadata: Metadata = { title: "Tenant analytics" };

export default async function TenantAnalyticsPage({ searchParams }: {
  searchParams: Promise<{ days?: string }>;
}) {
  const requestedDays = Number((await searchParams).days);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const analytics = await loadTenantAnalytics(days);
  const scans = analytics.trend.reduce((sum, item) => sum + item.scans, 0);
  const freshCount = analytics.trend.reduce((sum, item) => sum + item.fresh, 0);
  const mediumCount = analytics.trend.reduce((sum, item) => sum + item.medium, 0);
  const spoiledCount = analytics.trend.reduce((sum, item) => sum + item.spoiled, 0);
  const completed = freshCount + mediumCount + spoiledCount;
  const fresh = completed ? Math.round(freshCount / completed * 100) : 0;
  const medium = completed ? Math.round(mediumCount / completed * 100) : 0;
  const spoiled = completed ? Math.max(0, 100 - fresh - medium) : 0;
  return <div className="page-stack">
    <PageHeader eyebrow="Tenant private" title="Analytics" description="Only activity belonging to your organization is included." />
    <form action="/workspace/analytics" className="analytics-filters card">
      <label className="compact-select"><span>Date range</span><select name="days" defaultValue={days}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
      <button className="button button--secondary button--md">Apply</button>
    </form>
    <section className="stat-grid stat-grid--three">
      <StatCard label="Accepted scans" value={formatNumber(scans)} helper={`last ${days} days`} icon={<ScanLine size={21} />} />
      <StatCard label="Fresh" value={formatNumber(freshCount)} helper={completed ? `${fresh}% of classifications` : "no classifications"} icon={<Leaf size={21} />} tone="blue" />
      <StatCard label="Spoiled" value={formatNumber(spoiledCount)} helper={completed ? `${spoiled}% of classifications` : "no classifications"} icon={<TriangleAlert size={21} />} tone="red" />
    </section>
    <section className="dashboard-main-grid">
      <Card className="chart-card"><CardHeader title="Classification throughput" description={`Last ${days} days`} /><TrendChart data={analytics.trend} /></Card>
      <Card className="classification-card"><CardHeader title="Classification distribution" description="Fresh, medium, and spoiled" />{completed ? <ClassificationStack fresh={fresh} medium={medium} spoiled={spoiled} /> : <p className="context-note">No completed classifications in this period.</p>}</Card>
    </section>
  </div>;
}
