"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  Search,
  SlidersHorizontal,
  Store,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  initials,
} from "@/lib/formatters";
import type { ListPage } from "@/lib/api/admin-data";
import type { Tenant, TenantStatus } from "@/types/domain";
import styles from "./tenants.module.css";
import { TenantStatusBadge } from "./tenant-status-badge";
import { CreateTenantForm } from "./create-tenant-form";

type StatusFilter = "all" | TenantStatus;

function spoilageTone(rate: number) {
  if (rate >= 9) return "danger" as const;
  if (rate >= 7) return "warning" as const;
  return "success" as const;
}

export function TenantList({ result, search, status }: {
  result: ListPage<Tenant>;
  search: string;
  status: StatusFilter;
}) {
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const pageStart = (result.page - 1) * result.pageSize;
  const hasFilters = Boolean(search) || status !== "all";
  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (status !== "all") params.set("status", status);
    params.set("page", String(page));
    return `/tenants?${params}`;
  }

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="Vendor organizations"
        title="Tenants"
        description="Live tenant profiles and privacy-safe aggregate activity from the FreshLens API."
      />

      <CreateTenantForm />

      <form action="/tenants" method="get" className={`${styles.filtersCard} card`}>
        <div className={styles.searchField}>
          <Search size={18} aria-hidden="true" />
          <label htmlFor="tenant-search" className={styles.srOnly}>
            Search tenants
          </label>
          <input
            id="tenant-search"
            type="search"
            defaultValue={search}
            placeholder="Search tenant or contact"
            name="q"
          />
        </div>

        <div className={styles.filterField}>
          <SlidersHorizontal size={17} aria-hidden="true" />
          <label htmlFor="tenant-status">Status</label>
          <select
            id="tenant-status"
            defaultValue={status}
            name="status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <Button type="submit" variant="secondary" size="sm">Apply filters</Button>
        {hasFilters ? <Link href="/tenants" className="text-link">Clear filters</Link> : null}
      </form>

      <div className={styles.resultsSummary} aria-live="polite">
        <p>
          <strong>{formatNumber(result.total)}</strong>{" "}
          {result.total === 1 ? "tenant" : "tenants"}
          {hasFilters ? " match the current filters" : " from the API"}
        </p>
        <p>Aggregate activity only</p>
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<Store size={24} aria-hidden="true" />}
          title={hasFilters ? "No tenants match these filters" : "No tenants yet"}
          description={hasFilters ? "Try another search term or clear the status filter." : "Tenant profiles will appear here once they are provisioned."}
          action={
            hasFilters ? <Button href="/tenants" variant="secondary">Clear filters</Button> : undefined
          }
        />
      ) : (
        <Card className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>
                Vendor tenant profiles and aggregate platform activity
              </caption>
              <thead>
                <tr>
                  <th scope="col">Tenant</th>
                  <th scope="col">Last active</th>
                  <th scope="col">Scans this month</th>
                  <th scope="col">Spoilage rate</th>
                  <th scope="col">Alerts</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className={styles.srOnly}>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>
                      <div className={styles.tenantIdentity}>
                        <span className={styles.avatar} aria-hidden="true">
                          {initials(tenant.name)}
                        </span>
                        <span>
                          <Link
                            href={`/tenants/${tenant.id}`}
                            className={styles.primaryLink}
                          >
                            {tenant.name}
                          </Link>
                          <small>{[tenant.ownerName, tenant.email].filter(Boolean).join(" · ") || "No contact listed"}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      {tenant.lastActiveAt ? <span title={formatDateTime(tenant.lastActiveAt)}>{formatDate(tenant.lastActiveAt)}</span> : "—"}
                    </td>
                    <td>{formatNumber(tenant.scansThisMonth)}</td>
                    <td>
                      {tenant.completedClassifications ? <Badge tone={spoilageTone(tenant.spoilageRate)}>{formatPercent(tenant.spoilageRate)}</Badge> : "—"}
                    </td>
                    <td>{tenant.activeAlerts}</td>
                    <td><TenantStatusBadge status={tenant.status} /></td>
                    <td>
                      <Link
                        href={`/tenants/${tenant.id}`}
                        className={styles.viewLink}
                        aria-label={`View ${tenant.name}`}
                      >
                        <Eye size={17} aria-hidden="true" />
                        <span>View</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? <nav className={styles.pagination} aria-label="Tenant list pagination">
            <p>
              Showing {pageStart + 1}–
              {Math.min(pageStart + result.pageSize, result.total)} of{" "}
              {result.total}
            </p>
            <div>
              {result.page > 1 ? <Link href={pageHref(result.page - 1)} className={styles.pageButton} aria-label="Previous page"><ArrowLeft size={17} aria-hidden="true" /></Link> : null}
              <span className={styles.pageCount}>Page {result.page} of {totalPages}</span>
              {result.page < totalPages ? <Link href={pageHref(result.page + 1)} className={styles.pageButton} aria-label="Next page"><ArrowRight size={17} aria-hidden="true" /></Link> : null}
            </div>
          </nav> : null}
        </Card>
      )}
    </div>
  );
}
