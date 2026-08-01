"use client";

import { notFound } from "next/navigation";
import {
  BellRing,
  Boxes,
  Building2,
  Pencil,
  ScanLine,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatCard } from "@/components/ui/stat-card";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
} from "@/lib/formatters";
import { useAdminData } from "@/store/admin-data-provider";

import styles from "./tenants.module.css";
import { TenantStatusBadge } from "./tenant-status-badge";

export function TenantDetail({
  tenantId,
  updated = false,
}: {
  tenantId: string;
  updated?: boolean;
}) {
  const { tenants } = useAdminData();
  const tenant = tenants.find((item) => item.id === tenantId);

  if (!tenant) notFound();

  const classificationRows = [
    {
      key: "fresh" as const,
      label: "Fresh",
      value: tenant.classificationMix.fresh,
      tone: "green" as const,
    },
    {
      key: "medium" as const,
      label: "Medium",
      value: tenant.classificationMix.medium,
      tone: "amber" as const,
    },
    {
      key: "spoiled" as const,
      label: "Spoiled",
      value: tenant.classificationMix.spoiled,
      tone: "red" as const,
    },
  ];

  return (
    <div className={styles.pageStack}>
      <PageHeader
        breadcrumbs={[
          { label: "Tenants", href: "/tenants" },
          { label: tenant.name },
        ]}
        eyebrow="Tenant profile"
        title={tenant.name}
        description="Organization details and privacy-safe platform aggregates for this vendor."
        actions={
          <Button
            href={`/tenants/${tenant.id}/edit`}
            variant="secondary"
            icon={<Pencil size={16} aria-hidden="true" />}
          >
            Edit profile
          </Button>
        }
      />

      {updated ? (
        <div className={styles.successBanner} role="status">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Tenant profile updated</strong>
            <p>The saved name and status are now reflected in this demo workspace.</p>
          </div>
        </div>
      ) : null}

      <section className={styles.statGrid} aria-label="Tenant aggregate metrics">
        <StatCard
          label="Scans this month"
          value={formatNumber(tenant.scansThisMonth)}
          helper="Aggregate activity only"
          icon={<ScanLine size={20} aria-hidden="true" />}
          tone="blue"
        />
        <StatCard
          label="Spoilage rate"
          value={formatPercent(tenant.spoilageRate)}
          helper="Completed classifications"
          icon={<Boxes size={20} aria-hidden="true" />}
          tone={tenant.spoilageRate >= 9 ? "red" : "amber"}
        />
        <StatCard
          label="Active alerts"
          value={formatNumber(tenant.activeAlerts)}
          helper="Across alert categories"
          icon={<BellRing size={20} aria-hidden="true" />}
          tone={tenant.activeAlerts > 0 ? "amber" : "green"}
        />
        <StatCard
          label="Catalogue coverage"
          value={formatNumber(tenant.catalogueCoverage)}
          helper="Configured produce types"
          icon={<Building2 size={20} aria-hidden="true" />}
          tone="green"
        />
      </section>

      <div className={styles.detailGrid}>
        <Card className={styles.detailCard}>
          <CardHeader
            title="Organization profile"
            description="Basic platform-operational information for this tenant."
            action={<TenantStatusBadge status={tenant.status} />}
          />
          <dl className={styles.profileList}>
            <div>
              <dt>Organization</dt>
              <dd>{tenant.name}</dd>
            </div>
            <div>
              <dt>Primary contact</dt>
              <dd>{tenant.ownerName}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd><a href={`mailto:${tenant.email}`}>{tenant.email}</a></dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd><a href={`tel:${tenant.phone.replace(/\s/g, "")}`}>{tenant.phone}</a></dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{tenant.city}</dd>
            </div>
            <div>
              <dt>Workspace plan</dt>
              <dd><Badge tone="brand" dot={false}>{tenant.plan}</Badge></dd>
            </div>
            <div>
              <dt>Team members</dt>
              <dd className={styles.inlineValue}>
                <Users size={16} aria-hidden="true" />
                {tenant.memberCount}
              </dd>
            </div>
            <div>
              <dt>Joined platform</dt>
              <dd>{formatDate(tenant.createdAt)}</dd>
            </div>
            <div>
              <dt>Last active</dt>
              <dd>{formatDateTime(tenant.lastActiveAt)}</dd>
            </div>
            <div className={styles.profileListWide}>
              <dt>Tenant ID</dt>
              <dd><code>{tenant.id}</code></dd>
            </div>
          </dl>
        </Card>

        <Card className={styles.detailCard}>
          <CardHeader
            title="Freshness distribution"
            description="Aggregate share of this month's completed classifications."
          />
          <div className={styles.classificationList}>
            {classificationRows.map((row) => (
              <div className={styles.classificationRow} key={row.key}>
                <div>
                  <span>{row.label}</span>
                  <strong>{row.value}%</strong>
                </div>
                <ProgressBar
                  value={row.value}
                  tone={row.tone}
                  label={`${row.label} classifications`}
                />
              </div>
            ))}
          </div>
          <div className={styles.aggregateNote}>
            <ShieldCheck size={19} aria-hidden="true" />
            <p>
              These percentages are aggregated summaries. Platform administrators
              cannot inspect the tenant&apos;s individual scans, images, batches, or
              inventory records from this workspace.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
