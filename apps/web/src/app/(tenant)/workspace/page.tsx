import type { Metadata } from "next";
import { BellRing, Boxes, ScanLine, Users } from "lucide-react";

import { ClassificationStack, TrendChart } from "@/components/analytics/trend-chart";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { loadTenantAnalytics, loadTenantOverview } from "@/lib/api/tenant-data";
import { formatNumber } from "@/lib/formatters";

export const metadata: Metadata = { title: "Tenant overview" };

export default async function WorkspacePage() {
  const [overview, analytics] = await Promise.all([loadTenantOverview(), loadTenantAnalytics(30)]);
  const completed = overview.fresh_scans_this_month + overview.medium_scans_this_month + overview.spoiled_scans_this_month;
  const fresh = completed ? Math.round(overview.fresh_scans_this_month / completed * 100) : 0;
  const medium = completed ? Math.round(overview.medium_scans_this_month / completed * 100) : 0;
  return <div className="page-stack">
    <PageHeader eyebrow="Your organization" title={overview.tenant_name} description="Private inventory and scan signals for your tenant only." actions={<Button href="/workspace/team" variant="secondary">Manage team</Button>} />
    <section className="stat-grid">
      <StatCard label="Units in stock" value={formatNumber(overview.units_in_stock)} helper={`${overview.active_batches} active batches`} icon={<Boxes size={21} />} />
      <StatCard label="Monthly scans" value={formatNumber(overview.scans_this_month)} helper="accepted this month" icon={<ScanLine size={21} />} tone="blue" />
      <StatCard label="Active alerts" value={formatNumber(overview.active_alerts)} helper="need attention" icon={<BellRing size={21} />} tone="red" />
      <StatCard label="Team members" value={formatNumber(overview.team_members)} helper="tenant accounts" icon={<Users size={21} />} tone="amber" />
    </section>
    <section className="dashboard-main-grid">
      <Card className="chart-card"><CardHeader title="Scan activity" description="Last 30 days" /><TrendChart data={analytics.trend} /></Card>
      <Card className="classification-card"><CardHeader title="Freshness mix" description="Completed classifications this month" />{completed ? <ClassificationStack fresh={fresh} medium={medium} spoiled={Math.max(0, 100 - fresh - medium)} /> : <p className="context-note">No completed classifications this month.</p>}</Card>
    </section>
  </div>;
}
