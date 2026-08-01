"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Leaf,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { ProductStatusBadge } from "@/components/catalogue/product-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, formatNumber } from "@/lib/formatters";
import { useAdminData } from "@/store/admin-data-provider";
import type { ProductStatus } from "@/types/domain";

import styles from "./catalogue.module.css";

type StatusFilter = "all" | ProductStatus;

export function CatalogueScreen() {
  const { products } = useAdminData();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());

  const categories = useMemo(
    () =>
      [...new Set(products.map((product) => product.category))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [products],
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesQuery =
          !deferredQuery ||
          [product.name, product.scientificName, product.category].some((value) =>
            value?.toLocaleLowerCase().includes(deferredQuery),
          );
        const matchesCategory =
          category === "all" || product.category === category;
        const matchesStatus = status === "all" || product.status === status;
        return matchesQuery && matchesCategory && matchesStatus;
      }),
    [category, deferredQuery, products, status],
  );

  const activeFilters = query.length > 0 || category !== "all" || status !== "all";
  const activeCount = products.filter((product) => product.status === "active").length;
  const draftCount = products.filter((product) => product.status === "draft").length;

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setStatus("all");
  }

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="Catalogue operations"
        title="Product catalogue"
        description="Maintain the produce types used for identification, inventory records, and static aging rules."
        actions={
          <Button href="/catalogue/new" icon={<Plus size={17} aria-hidden="true" />}>
            Add product
          </Button>
        }
      />

      <section className={styles.summaryGrid} aria-label="Catalogue summary">
        <Card className={styles.summaryCard}>
          <span>Total products</span>
          <strong>{formatNumber(products.length)}</strong>
          <small>Produce types in the global catalogue</small>
        </Card>
        <Card className={styles.summaryCard}>
          <span>Active products</span>
          <strong>{formatNumber(activeCount)}</strong>
          <small>Available to vendor inventory workflows</small>
        </Card>
        <Card className={styles.summaryCard}>
          <span>Draft products</span>
          <strong>{formatNumber(draftCount)}</strong>
          <small>Awaiting catalogue review</small>
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
                placeholder="Product, scientific name, or category"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="catalogue-category">Category</label>
            <select
              id="catalogue-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="catalogue-status">Status</label>
            <select
              id="catalogue-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
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
                  <th scope="col">Category</th>
                  <th scope="col">Shelf life</th>
                  <th scope="col" className={styles.optionalColumn}>Coverage</th>
                  <th scope="col" className={styles.optionalColumn}>Monthly scans</th>
                  <th scope="col">Status</th>
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
                          <small>{product.scientificName || "Scientific name not set"}</small>
                        </span>
                      </Link>
                    </td>
                    <td>{product.category}</td>
                    <td><strong>{product.shelfLifeDays}</strong> days</td>
                    <td className={styles.optionalColumn}>{product.tenantCoverage} tenants</td>
                    <td className={styles.optionalColumn}>{formatNumber(product.scansThisMonth)}</td>
                    <td><ProductStatusBadge status={product.status} /></td>
                    <td className={styles.optionalColumn}>{formatDate(product.updatedAt)}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <Link
                          href={`/catalogue/${product.id}/edit`}
                          aria-label={`Edit ${product.name}`}
                          title={`Edit ${product.name}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </Link>
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
                  ? "Try a different search term or reset the category and status filters."
                  : "Add the first produce type to start building the platform catalogue."
              }
              action={
                activeFilters ? (
                  <Button variant="secondary" onClick={clearFilters}>Reset filters</Button>
                ) : (
                  <Button href="/catalogue/new" icon={<Plus size={16} aria-hidden="true" />}>
                    Add product
                  </Button>
                )
              }
            />
          </div>
        )}
      </Card>
    </div>
  );
}

