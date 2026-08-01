"use client";

import Link from "next/link";
import {
  BellRing,
  Box,
  CalendarClock,
  CircleDot,
  Edit3,
  Fingerprint,
  History,
  Layers3,
  Store,
} from "lucide-react";

import { AlertActions } from "@/components/alerts/alert-actions";
import {
  AlertSeverityBadge,
  AlertStatusBadge,
  AlertTypeBadge,
} from "@/components/alerts/alert-badges";
import { AlertNotFound } from "@/components/alerts/alert-not-found";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/formatters";
import { useAdminData } from "@/store/admin-data-provider";

import styles from "./alerts.module.css";

function typeGuidance(type: "spoilage" | "low_stock" | "aging" | "other") {
  switch (type) {
    case "spoilage":
      return "Spoilage alerts are classification-derived signals. They support vendor review and do not certify food safety.";
    case "low_stock":
      return "Low-stock alerts use thresholds configured by the vendor. Platform admins can review the alert but do not set that threshold here.";
    case "aging":
      return "Aging alerts use the static shelf-life configuration for the linked product or category, not a learned rot-date prediction.";
    case "other":
      return "Other alerts are operational notices that do not fit the three standard FreshLens inventory alert rules.";
  }
}

export function AlertDetail({ id }: { id: string }) {
  const { alerts, tenants, products } = useAdminData();
  const alert = alerts.find((item) => item.id === id);

  if (!alert) return <AlertNotFound id={id} />;

  const tenant = tenants.find((item) => item.id === alert.tenantId);
  const product = alert.productId
    ? products.find((item) => item.id === alert.productId)
    : undefined;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Alert record"
        title={alert.title}
        description="Review the tenant-facing message, linked context, and alert lifecycle."
        breadcrumbs={[
          { label: "Alerts", href: "/alerts" },
          { label: alert.title },
        ]}
        actions={
          <Button
            href={`/alerts/${alert.id}/edit`}
            variant="secondary"
            icon={<Edit3 size={16} aria-hidden="true" />}
          >
            Edit alert
          </Button>
        }
      />

      <section className={styles.detailHero} aria-labelledby="alert-message-title">
        <div className={styles.detailHeroIcon} aria-hidden="true">
          <BellRing size={24} />
        </div>
        <div className={styles.detailHeroMain}>
          <div className={styles.badgeRow}>
            <AlertTypeBadge type={alert.type} />
            <AlertSeverityBadge severity={alert.severity} />
            <AlertStatusBadge status={alert.status} />
          </div>
          <p className={styles.detailLabel} id="alert-message-title">
            Tenant-visible message
          </p>
          <p className={styles.detailMessage}>{alert.message}</p>
          <div className={styles.detailHeroMeta}>
            <span>
              <CalendarClock size={15} aria-hidden="true" />
              Created {formatDateTime(alert.createdAt)}
            </span>
            <span>
              <History size={15} aria-hidden="true" />
              Updated {formatDateTime(alert.updatedAt)}
            </span>
          </div>
        </div>
        <div className={styles.detailHeroActions}>
          <AlertActions alert={alert} />
        </div>
      </section>

      <div className={styles.detailGrid}>
        <Card className={styles.detailCard}>
          <CardHeader
            title="Recipient and context"
            description="Only the minimum operational context is exposed in the admin workspace."
          />
          <dl className={styles.definitionList}>
            <div>
              <dt>
                <Store size={17} aria-hidden="true" />
                Tenant
              </dt>
              <dd>
                {tenant ? (
                  <Link href={`/tenants/${tenant.id}`}>{tenant.name}</Link>
                ) : (
                  "Unavailable tenant"
                )}
                <span>{tenant?.city ?? alert.tenantId}</span>
              </dd>
            </div>
            <div>
              <dt>
                <Box size={17} aria-hidden="true" />
                Product
              </dt>
              <dd>
                {product ? (
                  <Link href={`/catalogue/${product.id}`}>{product.name}</Link>
                ) : (
                  "No product linked"
                )}
                <span>
                  {product
                    ? `${product.category} · ${product.shelfLifeDays}-day shelf life`
                    : "Optional context"}
                </span>
              </dd>
            </div>
            <div>
              <dt>
                <Layers3 size={17} aria-hidden="true" />
                Batch reference
              </dt>
              <dd>
                {alert.batchReference ?? "No batch reference"}
                <span>Display reference only; no raw inventory is shown</span>
              </dd>
            </div>
            <div>
              <dt>
                <Fingerprint size={17} aria-hidden="true" />
                Alert ID
              </dt>
              <dd className={styles.monospace}>{alert.id}</dd>
            </div>
          </dl>
        </Card>

        <Card className={styles.detailCard}>
          <CardHeader
            title="Lifecycle"
            description="Alerts are retained as audit-friendly records and are never hard-deleted here."
          />
          <ol className={styles.timeline}>
            <li className={styles.timelineComplete}>
              <span aria-hidden="true"><CircleDot size={16} /></span>
              <div>
                <strong>Created</strong>
                <p>{formatDateTime(alert.createdAt)}</p>
              </div>
            </li>
            <li
              className={
                alert.status === "acknowledged" || alert.status === "dismissed"
                  ? styles.timelineComplete
                  : styles.timelinePending
              }
            >
              <span aria-hidden="true"><CircleDot size={16} /></span>
              <div>
                <strong>Acknowledged</strong>
                <p>
                  {alert.status === "active"
                    ? "Awaiting admin review"
                    : alert.status === "acknowledged"
                      ? `Reviewed ${formatDateTime(alert.updatedAt)}`
                      : "Lifecycle advanced to dismissed"}
                </p>
              </div>
            </li>
            <li
              className={
                alert.status === "dismissed"
                  ? styles.timelineComplete
                  : styles.timelinePending
              }
            >
              <span aria-hidden="true"><CircleDot size={16} /></span>
              <div>
                <strong>Dismissed</strong>
                <p>
                  {alert.status === "dismissed"
                    ? `Closed ${formatDateTime(alert.updatedAt)}`
                    : "Available after confirmation"}
                </p>
              </div>
            </li>
          </ol>
        </Card>
      </div>

      <Card className={styles.guidanceBanner}>
        <span aria-hidden="true"><CircleDot size={20} /></span>
        <div>
          <strong>How FreshLens interprets this alert</strong>
          <p>{typeGuidance(alert.type)}</p>
        </div>
      </Card>
    </div>
  );
}
