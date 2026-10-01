"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Leaf,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ListPagination } from "@/components/ui/list-pagination";
import { formatDate, formatNumber } from "@/lib/formatters";
import type { ListPage } from "@/lib/api/admin-data";
import type { CategoryShelfLife, Product } from "@/types/domain";

import { ShelfLifeRules } from "./shelf-life-rules";

import styles from "./catalogue.module.css";

export function CatalogueScreen({ result, rules, search, tenantId }: {
  result: ListPage<Product>;
  rules: CategoryShelfLife[];
  search: string;
  tenantId?: string;
}) {
  const activeFilters = Boolean(search || tenantId);
  const hasSearch = Boolean(search);

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="Catalogue operations"
        title="Product catalogue"
        description="Manage the shared produce catalogue available to every tenant."
      />

      <ShelfLifeRules rules={rules} />

      <section className={styles.summaryGrid} aria-label="Catalogue summary">
        <Card className={styles.summaryCard}>
          <span>{hasSearch ? "Matching products" : "Global products"}</span>
          <strong>{formatNumber(result.total)}</strong>
          <small>{tenantId ? "Monthly scans filtered to the selected tenant" : "Available to every tenant"}</small>
        </Card>
      </section>

      <Card className={styles.catalogueCard}>
        <form action="/catalogue" method="get" className={styles.toolbar}>
          {tenantId ? <input type="hidden" name="tenant" value={tenantId} /> : null}
          <div className={styles.searchField}>
            <label htmlFor="catalogue-search">Search catalogue</label>
            <div className={styles.inputWithIcon}>
              <Search size={17} aria-hidden="true" />
              <input
                id="catalogue-search"
                type="search"
                name="q"
                defaultValue={search}
                placeholder="Search product"
              />
            </div>
          </div>

          <Button type="submit" variant="secondary">Search</Button>
          {activeFilters ? <Link href="/catalogue" className={styles.clearButton}>Clear filters</Link> : null}
        </form>

        <div className={styles.resultBar} aria-live="polite">
          <span className={styles.resultIcon} aria-hidden="true">
            <SlidersHorizontal size={15} />
          </span>
          Showing <strong>{result.items.length}</strong> of {result.total} products
        </div>

        {result.items.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>FreshLens product catalogue</caption>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Shelf life</th>
                  <th scope="col" className={styles.optionalColumn}>Low-stock threshold</th>
                  <th scope="col" className={styles.optionalColumn}>Monthly scans</th>
                  <th scope="col" className={styles.optionalColumn}>Updated</th>
                  <th scope="col"><span className={styles.srOnly}>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((product) => (
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
              title={hasSearch ? "No products match this search" : "No catalogue products yet"}
              description={
                hasSearch
                  ? "Try another product name or clear the search."
                  : "Add products to the shared catalogue before vendors scan inventory."
              }
              action={
                activeFilters ? (
                  <Button href="/catalogue" variant="secondary">Reset filters</Button>
                ) : undefined
              }
            />
          </div>
        )}
        <ListPagination path="/catalogue" page={result.page} pageSize={result.pageSize} total={result.total} filters={{ q: search, tenant: tenantId }} />
      </Card>
    </div>
  );
}
