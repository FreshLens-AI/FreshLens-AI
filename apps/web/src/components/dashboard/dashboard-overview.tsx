"use client";

import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Boxes,
  Building2,
  ChartNoAxesCombined,
  Clock3,
  Leaf,
  ScanLine,
  Settings2,
  Sparkles,
} from "lucide-react";

import { ClassificationStack, TrendChart } from "@/components/analytics/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { adminActivity, platformTrend } from "@/data/mock-data";
import { formatDateTime, formatNumber, formatPercent, initials } from "@/lib/formatters";
import { alertSeverityTone, titleCase } from "@/lib/presentation";
import { useAdminData } from "@/store/admin-data-provider";

export function DashboardOverview() {
  const { alerts, products, tenants } = useAdminData();
  const activeTenants = tenants.filter((tenant) => tenant.status === "active");
  const totalScans = tenants.reduce((sum, tenant) => sum + tenant.scansThisMonth, 0);
  const activeAlerts = alerts.filter((alert) => alert.status === "active");
  const weighted = (key: "fresh" | "medium" | "spoiled") =>
    Math.round(
      tenants.reduce(
        (sum, tenant) => sum + tenant.scansThisMonth * tenant.classificationMix[key],
        0,
      ) / Math.max(totalScans, 1),
    );
  const fresh = weighted("fresh");
  const medium = weighted("medium");
  const spoiled = Math.max(0, 100 - fresh - medium);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Friday, 31 July 2026"
        title="Good morning, Admin"
        description="Here’s the platform picture across FreshLens vendors. All operational figures below are aggregate demo data."
        actions={<Button href="/analytics" variant="secondary" icon={<ChartNoAxesCombined size={17} />}>View analytics</Button>}
      />

      <section className="stat-grid" aria-label="Platform summary">
        <StatCard label="Active tenants" value={`${activeTenants.length}`} helper={`of ${tenants.length} onboarded`} icon={<Building2 size={21} />} trend={{ value: "+2 this month", direction: "up" }} />
        <StatCard label="Monthly scans" value={formatNumber(totalScans)} helper="aggregate submissions" icon={<ScanLine size={21} />} tone="blue" trend={{ value: "12.4%", direction: "up" }} />
        <StatCard label="Catalogue items" value={`${products.length}`} helper={`${products.filter((item) => item.status === "active").length} published`} icon={<Leaf size={21} />} tone="amber" />
        <StatCard label="Active alerts" value={`${activeAlerts.length}`} helper={`${activeAlerts.filter((item) => item.severity === "critical").length} critical`} icon={<BellRing size={21} />} tone="red" trend={{ value: "2 fewer", direction: "down", positive: true }} />
      </section>

      <section className="dashboard-main-grid">
        <Card className="chart-card">
          <CardHeader
            title="Platform scan volume"
            description="Accepted scans across all tenants · last 12 days"
            action={<Link href="/scans" className="text-link">Open activity <ArrowRight size={15} /></Link>}
          />
          <div className="chart-summary-row">
            <div><strong>241</strong><span>today</span></div>
            <div><strong>1.9k</strong><span>last 12 days</span></div>
            <Badge tone="success">Healthy throughput</Badge>
          </div>
          <TrendChart data={platformTrend} />
        </Card>

        <Card className="classification-card">
          <CardHeader title="Freshness mix" description="Completed classifications this month" />
          <div className="classification-card__hero">
            <div className="donut" style={{ background: `conic-gradient(#36a66f 0 ${fresh}%, #e6a23c ${fresh}% ${fresh + medium}%, #d45c4c ${fresh + medium}% 100%)` }}>
              <span><strong>{fresh}%</strong><small>Fresh</small></span>
            </div>
          </div>
          <ClassificationStack fresh={fresh} medium={medium} spoiled={spoiled} />
          <p className="context-note"><Sparkles size={16} /> Labels reflect model classifications, not measured disposal or waste.</p>
        </Card>
      </section>

      <section className="dashboard-secondary-grid">
        <Card>
          <CardHeader title="Tenants at a glance" description="Aggregate adoption and spoilage signals" action={<Link href="/tenants" className="text-link">View all <ArrowRight size={15} /></Link>} />
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tenant</th><th>Status</th><th>Monthly scans</th><th>Spoiled signals</th><th><span className="sr-only">Open</span></th></tr></thead>
              <tbody>
                {tenants.slice(0, 4).map((tenant) => (
                  <tr key={tenant.id}>
                    <td><div className="entity-cell"><span className="entity-avatar">{initials(tenant.name)}</span><div><strong>{tenant.name}</strong><small>{tenant.city}</small></div></div></td>
                    <td><Badge tone={tenant.status === "active" ? "success" : "neutral"}>{titleCase(tenant.status)}</Badge></td>
                    <td>{formatNumber(tenant.scansThisMonth)}</td>
                    <td><span className={tenant.spoilageRate >= 9 ? "metric metric--danger" : "metric"}>{formatPercent(tenant.spoilageRate)}</span></td>
                    <td><Link href={`/tenants/${tenant.id}`} className="row-link" aria-label={`Open ${tenant.name}`}><ArrowRight size={17} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Needs attention" description="Active platform-level alert signals" action={<Link href="/alerts" className="text-link">Review all <ArrowRight size={15} /></Link>} />
          <div className="alert-list-compact">
            {activeAlerts.slice(0, 3).map((alert) => {
              const tenant = tenants.find((item) => item.id === alert.tenantId);
              return (
                <Link href={`/alerts/${alert.id}`} className="alert-compact" key={alert.id}>
                  <span className={`alert-compact__icon alert-compact__icon--${alert.severity}`}><BellRing size={17} /></span>
                  <span className="alert-compact__copy"><strong>{alert.title}</strong><small>{tenant?.name ?? "Unknown tenant"} · {formatDateTime(alert.createdAt)}</small></span>
                  <Badge tone={alertSeverityTone(alert.severity)}>{titleCase(alert.severity)}</Badge>
                </Link>
              );
            })}
          </div>
        </Card>
      </section>

      <section className="dashboard-secondary-grid">
        <Card>
          <CardHeader title="Quick actions" description="Common platform administration tasks" />
          <div className="quick-actions">
            <Link href="/catalogue/new"><span className="quick-action__icon"><Leaf size={19} /></span><span><strong>Add catalogue item</strong><small>Create a produce type</small></span><ArrowRight size={17} /></Link>
            <Link href="/shelf-life"><span className="quick-action__icon quick-action__icon--amber"><Settings2 size={19} /></span><span><strong>Configure shelf life</strong><small>Review static aging rules</small></span><ArrowRight size={17} /></Link>
            <Link href="/alerts/new"><span className="quick-action__icon quick-action__icon--red"><BellRing size={19} /></span><span><strong>Create an alert</strong><small>Notify a tenant</small></span><ArrowRight size={17} /></Link>
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent admin activity" description="Changes made in this demo workspace" />
          <div className="activity-list">
            {adminActivity.map((activity) => (
              <div className="activity-item" key={activity.id}>
                <span className={`activity-item__dot activity-item__dot--${activity.tone}`} />
                <div><strong>{activity.action}</strong><p>{activity.subject} · {activity.detail}</p></div>
                <span><Clock3 size={13} /> {formatDateTime(activity.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card className="privacy-banner">
        <div className="privacy-banner__icon"><Boxes size={19} /></div>
        <div><strong>Designed around tenant privacy</strong><p>This workspace exposes tenant profiles and deliberately aggregated insights only. Vendor images, individual scans, quantities, and inventory records are not available to platform admins.</p></div>
      </Card>
    </div>
  );
}
