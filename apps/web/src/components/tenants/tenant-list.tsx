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
import { useMemo, useState } from "react";

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
import { useAdminData } from "@/store/admin-data-provider";
import type { TenantPlan, TenantStatus } from "@/types/domain";

import styles from "./tenants.module.css";
import { TenantStatusBadge } from "./tenant-status-badge";

const PAGE_SIZE = 5;

type StatusFilter = "all" | TenantStatus;
type PlanFilter = "all" | TenantPlan;

function spoilageTone(rate: number) {
  if (rate >= 9) return "danger" as const;
  if (rate >= 7) return "warning" as const;
  return "success" as const;
}

export function TenantList() {
  const { tenants } = useAdminData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [page, setPage] = useState(1);

  const filteredTenants = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return tenants.filter((tenant) => {
      const searchableText = [
        tenant.name,
        tenant.ownerName,
        tenant.email,
        tenant.city,
      ]
        .join(" ")
        .toLocaleLowerCase();

      return (
        (!normalizedQuery || searchableText.includes(normalizedQuery)) &&
        (status === "all" || tenant.status === status) &&
        (plan === "all" || tenant.plan === plan)
      );
    });
  }, [plan, query, status, tenants]);

  const totalPages = Math.max(1, Math.ceil(filteredTenants.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleTenants = filteredTenants.slice(pageStart, pageStart + PAGE_SIZE);
  const hasFilters = query.length > 0 || status !== "all" || plan !== "all";

  function resetFilters() {
    setQuery("");
    setStatus("all");
    setPlan("all");
    setPage(1);
  }

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="Vendor organizations"
        title="Tenants"
        description="Review vendor profiles and platform-level activity without exposing private scan or inventory records."
      />

      <Card className={styles.filtersCard}>
        <div className={styles.searchField}>
          <Search size={18} aria-hidden="true" />
          <label htmlFor="tenant-search" className={styles.srOnly}>
            Search tenants
          </label>
          <input
            id="tenant-search"
            type="search"
            value={query}
            placeholder="Search name, owner, email or city"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className={styles.filterField}>
          <SlidersHorizontal size={17} aria-hidden="true" />
          <label htmlFor="tenant-status">Status</label>
          <select
            id="tenant-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className={styles.filterField}>
          <label htmlFor="tenant-plan">Plan</label>
          <select
            id="tenant-plan"
            value={plan}
            onChange={(event) => {
              setPlan(event.target.value as PlanFilter);
              setPage(1);
            }}
          >
            <option value="all">All plans</option>
            <option value="Starter">Starter</option>
            <option value="Growth">Growth</option>
            <option value="Pilot">Pilot</option>
          </select>
        </div>

        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
        ) : null}
      </Card>

      <div className={styles.resultsSummary} aria-live="polite">
        <p>
          <strong>{formatNumber(filteredTenants.length)}</strong>{" "}
          {filteredTenants.length === 1 ? "tenant" : "tenants"}
          {hasFilters ? " match the current filters" : " in the workspace"}
        </p>
        <p>Profile and aggregate data only</p>
      </div>

      {visibleTenants.length === 0 ? (
        <EmptyState
          icon={<Store size={24} aria-hidden="true" />}
          title="No tenants match these filters"
          description="Try another search term or clear the selected status and plan filters."
          action={
            <Button variant="secondary" onClick={resetFilters}>
              Clear filters
            </Button>
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
                  <th scope="col">Location</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Last active</th>
                  <th scope="col">Scans this month</th>
                  <th scope="col">Spoilage rate</th>
                  <th scope="col">Alerts</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className={styles.srOnly}>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleTenants.map((tenant) => (
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
                          <small>{tenant.ownerName} · {tenant.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>{tenant.city}</td>
                    <td><Badge tone="brand" dot={false}>{tenant.plan}</Badge></td>
                    <td>
                      <span title={formatDateTime(tenant.lastActiveAt)}>
                        {formatDate(tenant.lastActiveAt)}
                      </span>
                    </td>
                    <td>{formatNumber(tenant.scansThisMonth)}</td>
                    <td>
                      <Badge tone={spoilageTone(tenant.spoilageRate)}>
                        {formatPercent(tenant.spoilageRate)}
                      </Badge>
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

          <nav className={styles.pagination} aria-label="Tenant list pagination">
            <p>
              Showing {pageStart + 1}–
              {Math.min(pageStart + PAGE_SIZE, filteredTenants.length)} of{" "}
              {filteredTenants.length}
            </p>
            <div>
              <button
                type="button"
                className={styles.pageButton}
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                aria-label="Previous page"
              >
                <ArrowLeft size={17} aria-hidden="true" />
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                (pageNumber) => (
                  <button
                    type="button"
                    key={pageNumber}
                    className={`${styles.pageButton}${
                      pageNumber === currentPage ? ` ${styles.pageButtonActive}` : ""
                    }`}
                    aria-current={pageNumber === currentPage ? "page" : undefined}
                    aria-label={`Page ${pageNumber}`}
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ),
              )}
              <button
                type="button"
                className={styles.pageButton}
                disabled={currentPage === totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                aria-label="Next page"
              >
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </div>
          </nav>
        </Card>
      )}
    </div>
  );
}
