"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Leaf,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, formatNumber } from "@/lib/formatters";
import { useAdminData } from "@/store/admin-data-provider";

import styles from "./catalogue.module.css";

export function CatalogueScreen() {
  const { products } = useAdminData();
  const [query, setQuery] = useState("");
  const [tenantId, setTenantId] = useState("all");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());

  const tenants = useMemo(
    () =>
      [...new Map(products.map((product) => [product.tenantId, product.tenantName])).entries()]
        .sort((a, b) => a[1].localeCompare(b[1])),
    [products],
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesQuery =
          !deferredQuery ||
          [product.name, product.tenantName].some((value) =>
            value?.toLocaleLowerCase().includes(deferredQuery),
          );
        return matchesQuery && (tenantId === "all" || product.tenantId === tenantId);
      }),
    [deferredQuery, products, tenantId],
  );

  const activeFilters = query.length > 0 || tenantId !== "all";
  const monthlyScans = products.reduce(
    (sum, product) => sum + product.scansThisMonth,
    0,
  );

  function clearFilters() {
    setQuery("");
    setTenantId("all");
  }

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="Catalogue operations"
        title="Product catalogue"
        description="Tenant product settings and shelf-life values from the live API."
      />

      <section className={styles.summaryGrid} aria-label="Catalogue summary">
        <Card className={styles.summaryCard}>
          <span>Total products</span>
          <strong>{formatNumber(products.length)}</strong>
          <small>Tenant product configurations</small>
        </Card>
        <Card className={styles.summaryCard}>
          <span>Tenants represented</span>
          <strong>{formatNumber(tenants.length)}</strong>
          <small>With configured products</small>
        </Card>
        <Card className={styles.summaryCard}>
          <span>Monthly scans</span>
          <strong>{formatNumber(monthlyScans)}</strong>
          <small>Across linked tenant products</small>
        </Card>
      </section>

      <Card className={styles.catalogueCard}>
        <div className={styles.toolbar}>
          <div className={styles.searchField}>
            <label htmlFor="catalogue-search">Search catalogue</label>
            <div className={styles.inputWithIcon}>
              <Search size={17} aria-hidden="true" />
              <input
                id="catalogue-search"
                type="search"
                value={query}
                placeholder="Search product or tenant"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="catalogue-tenant">Tenant</label>
            <select
              id="catalogue-tenant"
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
            >
              <option value="all">All tenants</option>
              {tenants.map(([id, name]) => (
                <option value={id} key={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {activeFilters ? (
            <button type="button" className={styles.clearButton} onClick={clearFilters}>
              <X size={15} aria-hidden="true" />
              Clear filters
            </button>
          ) : null}
        </div>

        <div className={styles.resultBar} aria-live="polite">
          <span className={styles.resultIcon} aria-hidden="true">
            <SlidersHorizontal size={15} />
          </span>
          Showing <strong>{filteredProducts.length}</strong> of {products.length} products
        </div>

        {filteredProducts.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>FreshLens product catalogue</caption>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Tenant</th>
                  <th scope="col">Shelf life</th>
                  <th scope="col" className={styles.optionalColumn}>Low-stock threshold</th>
                  <th scope="col" className={styles.optionalColumn}>Monthly scans</th>
                  <th scope="col" className={styles.optionalColumn}>Updated</th>
                  <th scope="col"><span className={styles.srOnly}>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <Link href={`/catalogue/${product.id}`} className={styles.productLink}>
                        <span className={styles.productMark} aria-hidden="true">
                          <Leaf size={16} />
                        </span>
                        <span>
                          <strong>{product.name}</strong>
                        </span>
                      </Link>
                    </td>
                    <td>{product.tenantName}</td>
                    <td><strong>{product.shelfLifeDays}</strong> days</td>
                    <td className={styles.optionalColumn}>{formatNumber(product.lowStockThreshold ?? 0)}</td>
                    <td className={styles.optionalColumn}>{formatNumber(product.scansThisMonth)}</td>
                    <td className={styles.optionalColumn}>{formatDate(product.updatedAt)}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <Link
                          href={`/catalogue/${product.id}`}
                          aria-label={`View ${product.name}`}
                          title={`View ${product.name}`}
                        >
                          <ArrowUpRight size={17} aria-hidden="true" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.embeddedEmpty}>
            <EmptyState
              icon={<Leaf size={24} aria-hidden="true" />}
              title={activeFilters ? "No products match these filters" : "No catalogue products yet"}
              description={
                activeFilters
                  ? "Try another product or tenant, or clear the filters."
                  : "Products will appear after vendors configure their catalogues."
              }
              action={
                activeFilters ? (
                  <Button variant="secondary" onClick={clearFilters}>Reset filters</Button>
                ) : undefined
              }
            />
          </div>
        )}
      </Card>
    </div>
  );
}
