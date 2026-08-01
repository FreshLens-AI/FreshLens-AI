"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BellPlus,
  BellRing,
  CheckCircle2,
  CircleAlert,
  FilterX,
  Search,
} from "lucide-react";

import { AlertActions } from "@/components/alerts/alert-actions";
import {
  AlertSeverityBadge,
  AlertStatusBadge,
  AlertTypeBadge,
} from "@/components/alerts/alert-badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/formatters";
import { useAdminData } from "@/store/admin-data-provider";
import type {
  AlertSeverity,
  AlertStatus,
  AlertType,
} from "@/types/domain";

import {
  alertSeverityOptions,
  alertStatusOptions,
  alertTypeOptions,
} from "./alert-options";
import styles from "./alerts.module.css";

type TypeFilter = AlertType | "all";
type SeverityFilter = AlertSeverity | "all";
type StatusFilter = AlertStatus | "all";

export function AlertsIndex() {
  const { alerts, tenants, products } = useAdminData();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const tenantById = useMemo(
    () => new Map(tenants.map((tenant) => [tenant.id, tenant])),
    [tenants],
  );
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const filteredAlerts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...alerts]
      .filter((alert) => {
        if (typeFilter !== "all" && alert.type !== typeFilter) return false;
        if (severityFilter !== "all" && alert.severity !== severityFilter)
          return false;
        if (statusFilter !== "all" && alert.status !== statusFilter) return false;
        if (!normalizedQuery) return true;

        const tenant = tenantById.get(alert.tenantId);
        const product = alert.productId
          ? productById.get(alert.productId)
          : undefined;
        return [
          alert.id,
          alert.title,
          alert.message,
          alert.type,
          alert.severity,
          alert.status,
          alert.batchReference,
          tenant?.name,
          product?.name,
        ].some((value) => value?.toLowerCase().includes(normalizedQuery));
      })
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      );
  }, [
    alerts,
    productById,
    query,
    severityFilter,
    statusFilter,
    tenantById,
    typeFilter,
  ]);

  const activeCount = alerts.filter((alert) => alert.status === "active").length;
  const criticalCount = alerts.filter(
    (alert) => alert.severity === "critical" && alert.status !== "dismissed",
  ).length;
  const acknowledgedCount = alerts.filter(
    (alert) => alert.status === "acknowledged",
  ).length;
  const dismissedCount = alerts.filter(
    (alert) => alert.status === "dismissed",
  ).length;
  const filtersApplied =
    query.length > 0 ||
    typeFilter !== "all" ||
    severityFilter !== "all" ||
    statusFilter !== "all";

  function clearFilters() {
    setQuery("");
    setTypeFilter("all");
    setSeverityFilter("all");
    setStatusFilter("all");
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Platform operations"
        title="Alerts"
        description="Review tenant-visible spoilage, low-stock, aging, and operational alerts without exposing private scan records."
        actions={
          <Button
            href="/alerts/new"
            icon={<BellPlus size={17} aria-hidden="true" />}
          >
            Create alert
          </Button>
        }
      />

      <section className={styles.statsGrid} aria-label="Alert summary">
        <Card className={styles.summaryCard}>
          <span className={`${styles.summaryIcon} ${styles.summaryIconRed}`}>
            <BellRing size={20} aria-hidden="true" />
          </span>
          <div>
            <p>Active</p>
            <strong>{activeCount}</strong>
            <small>Awaiting review</small>
          </div>
        </Card>
        <Card className={styles.summaryCard}>
          <span className={`${styles.summaryIcon} ${styles.summaryIconAmber}`}>
            <CircleAlert size={20} aria-hidden="true" />
          </span>
          <div>
            <p>Critical open</p>
            <strong>{criticalCount}</strong>
            <small>Active or acknowledged</small>
          </div>
        </Card>
        <Card className={styles.summaryCard}>
          <span className={`${styles.summaryIcon} ${styles.summaryIconGreen}`}>
            <CheckCircle2 size={20} aria-hidden="true" />
          </span>
          <div>
            <p>Acknowledged</p>
            <strong>{acknowledgedCount}</strong>
            <small>Reviewed, still retained</small>
          </div>
        </Card>
        <Card className={styles.summaryCard}>
          <span className={`${styles.summaryIcon} ${styles.summaryIconSlate}`}>
            <FilterX size={20} aria-hidden="true" />
          </span>
          <div>
            <p>Dismissed</p>
            <strong>{dismissedCount}</strong>
            <small>Kept in history</small>
          </div>
        </Card>
      </section>

      <Card className={styles.listCard}>
        <div className={styles.filterBar}>
          <div className={styles.searchControl}>
            <Search size={18} aria-hidden="true" />
            <label htmlFor="alert-search" className="sr-only">
              Search alerts
            </label>
            <input
              id="alert-search"
              type="search"
              value={query}
              placeholder="Search title, tenant, product, batch, or ID"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className={styles.filterControls}>
            <label>
              <span className="sr-only">Filter by type</span>
              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as TypeFilter)
                }
              >
                <option value="all">All types</option>
                {alertTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by severity</span>
              <select
                value={severityFilter}
                onChange={(event) =>
                  setSeverityFilter(event.target.value as SeverityFilter)
                }
              >
                <option value="all">All severities</option>
                {alertSeverityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
              >
                <option value="all">All statuses</option>
                {alertStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {filtersApplied ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<FilterX size={16} aria-hidden="true" />}
                onClick={clearFilters}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        <div className={styles.listMeta} aria-live="polite">
          <p>
            Showing <strong>{filteredAlerts.length}</strong> of {alerts.length} alerts
          </p>
          <p>Newest alerts first</p>
        </div>

        {filteredAlerts.length > 0 ? (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Alert</th>
                  <th scope="col">Tenant</th>
                  <th scope="col">Context</th>
                  <th scope="col">Severity &amp; status</th>
                  <th scope="col">Created</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((alert) => {
                  const tenant = tenantById.get(alert.tenantId);
                  const product = alert.productId
                    ? productById.get(alert.productId)
                    : undefined;
                  return (
                    <tr key={alert.id}>
                      <td>
                        <div className={styles.alertCell}>
                          <AlertTypeBadge type={alert.type} />
                          <Link href={`/alerts/${alert.id}`}>{alert.title}</Link>
                          <p>{alert.message}</p>
                        </div>
                      </td>
                      <td>
                        <div className={styles.tenantCell}>
                          <strong>{tenant?.name ?? "Unknown tenant"}</strong>
                          <span>{tenant?.city ?? alert.tenantId}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.contextCell}>
                          <strong>{product?.name ?? "No product linked"}</strong>
                          <span>{alert.batchReference ?? "No batch reference"}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.badgeStack}>
                          <AlertSeverityBadge severity={alert.severity} />
                          <AlertStatusBadge status={alert.status} />
                        </div>
                      </td>
                      <td>
                        <time dateTime={alert.createdAt} className={styles.timeCell}>
                          {formatDateTime(alert.createdAt)}
                        </time>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <Button
                            href={`/alerts/${alert.id}`}
                            variant="ghost"
                            size="sm"
                          >
                            View
                          </Button>
                          <AlertActions alert={alert} compact />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyWrap}>
            <EmptyState
              icon={<BellRing size={23} aria-hidden="true" />}
              title={filtersApplied ? "No alerts match these filters" : "No alerts yet"}
              description={
                filtersApplied
                  ? "Try a broader search or clear the filters to return to the full alert history."
                  : "Create the first tenant-visible alert for this demo workspace."
              }
              action={
                filtersApplied ? (
                  <Button type="button" variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button href="/alerts/new">Create alert</Button>
                )
              }
            />
          </div>
        )}
      </Card>
    </div>
  );
}
