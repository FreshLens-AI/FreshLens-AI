"use client";

import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Building2,
  ChartNoAxesCombined,
  Leaf,
  ScanLine,
} from "lucide-react";

import { ClassificationStack, TrendChart } from "@/components/analytics/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatDateTime, formatNumber, formatPercent, initials } from "@/lib/formatters";
import { alertSeverityTone, titleCase } from "@/lib/presentation";
import { useAdminData } from "@/store/admin-data-provider";
import type { AdminOverview } from "@/lib/api/admin-data";

export function DashboardOverview({ overview }: { overview: AdminOverview }) {
  const { alerts, tenants, trend } = useAdminData();
  const activeAlerts = alerts;
  const completed = overview.monthly_fresh + overview.monthly_medium + overview.monthly_spoiled;
  const freshCount = overview.monthly_fresh;
  const mediumCount = overview.monthly_medium;
  const fresh = completed ? Math.round((freshCount / completed) * 100) : 0;
  const medium = completed ? Math.round((mediumCount / completed) * 100) : 0;
  const spoiled = completed ? Math.max(0, 100 - fresh - medium) : 0;
  const recentScans = trend.reduce((sum, point) => sum + point.scans, 0);
  const todayScans = trend.at(-1)?.scans ?? 0;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Workspace"
        title="Platform overview"
        description="Tenant activity and produce classification at a glance."
        actions={<Button href="/analytics" variant="secondary" icon={<ChartNoAxesCombined size={17} />}>View analytics</Button>}
      />

      <section className="stat-grid" aria-label="Platform summary">
        <StatCard label="Active tenants" value={`${overview.active_tenants}`} helper={`of ${overview.total_tenants} onboarded`} icon={<Building2 size={21} />} />
        <StatCard label="Monthly scans" value={formatNumber(overview.monthly_scans)} helper="aggregate submissions" icon={<ScanLine size={21} />} tone="blue" />
        <StatCard label="Configured products" value={`${overview.total_products}`} helper="across all tenants" icon={<Leaf size={21} />} tone="amber" />
        <StatCard label="Active alerts" value={`${overview.active_alerts}`} helper={`${overview.critical_alerts} critical`} icon={<BellRing size={21} />} tone="red" />
      </section>

      <section className="dashboard-main-grid">
        <Card className="chart-card">
          <CardHeader
            title="Platform scan volume"
            description="Accepted scans across all tenants · last 90 days"
            action={<Link href="/scans" className="text-link">Open activity <ArrowRight size={15} /></Link>}
          />
          <div className="chart-summary-row">
            <div><strong>{formatNumber(todayScans)}</strong><span>today</span></div>
            <div><strong>{formatNumber(recentScans)}</strong><span>last 90 days</span></div>
          </div>
          <TrendChart data={trend} />
        </Card>

        <Card className="classification-card">
          <CardHeader title="Freshness mix" description="Completed classifications this month" />
          {completed ? <div className="classification-card__hero">
            <div className="donut" style={{ background: `conic-gradient(#36a66f 0 ${fresh}%, #e6a23c ${fresh}% ${fresh + medium}%, #d45c4c ${fresh + medium}% 100%)` }}>
              <span><strong>{fresh}%</strong><small>Fresh</small></span>
            </div>
          </div> : <EmptyState icon={<Leaf size={22} />} title="No classifications yet" description="The freshness mix appears after scans complete." />}
          {completed ? <ClassificationStack fresh={fresh} medium={medium} spoiled={spoiled} /> : null}
          {completed ? <p className="context-note">Based on {formatNumber(completed)} completed classifications this month.</p> : null}
        </Card>
      </section>

      <section className="dashboard-secondary-grid">
        <Card>
          <CardHeader title="Tenants at a glance" description="Live aggregate adoption and spoilage signals" action={<Link href="/tenants" className="text-link">View all <ArrowRight size={15} /></Link>} />
          {tenants.length ? <div className="table-wrap">
            <table>
              <thead><tr><th>Tenant</th><th>Status</th><th>Monthly scans</th><th>Spoiled signals</th><th><span className="sr-only">Open</span></th></tr></thead>
              <tbody>
                {tenants.slice(0, 4).map((tenant) => (
                  <tr key={tenant.id}>
                    <td><div className="entity-cell"><span className="entity-avatar">{initials(tenant.name)}</span><div><strong>{tenant.name}</strong><small>{tenant.ownerName ?? "No contact listed"}</small></div></div></td>
                    <td><Badge tone={tenant.status === "active" ? "success" : "neutral"}>{titleCase(tenant.status)}</Badge></td>
                    <td>{formatNumber(tenant.scansThisMonth)}</td>
                    <td>{tenant.completedClassifications ? <span className={tenant.spoilageRate >= 9 ? "metric metric--danger" : "metric"}>{formatPercent(tenant.spoilageRate)}</span> : "—"}</td>
                    <td><Link href={`/tenants/${tenant.id}`} className="row-link" aria-label={`Open ${tenant.name}`}><ArrowRight size={17} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div> : <EmptyState icon={<Building2 size={22} />} title="No tenants yet" description="Tenant activity appears after organizations are provisioned." />}
        </Card>

        <Card>
          <CardHeader title="Needs attention" description="Live alert signals" action={<Link href="/alerts" className="text-link">Review all <ArrowRight size={15} /></Link>} />
          {activeAlerts.length ? <div className="alert-list-compact">
            {activeAlerts.slice(0, 3).map((alert) => {
              return (
                <div className="alert-compact" key={alert.id}>
                  <span className={`alert-compact__icon alert-compact__icon--${alert.severity}`}><BellRing size={17} /></span>
                  <span className="alert-compact__copy"><strong>{alert.title}</strong><small>{alert.tenantName ?? "Unknown tenant"} · {formatDateTime(alert.createdAt)}</small></span>
                  <Badge tone={alertSeverityTone(alert.severity)}>{titleCase(alert.severity)}</Badge>
                </div>
              );
            })}
          </div> : <EmptyState icon={<BellRing size={22} />} title="All clear" description="No active alerts need attention." />}
        </Card>
      </section>
    </div>
  );
}
