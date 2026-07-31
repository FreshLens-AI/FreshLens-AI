"use client";

import { useParams, useSearchParams } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Layers3,
  PackageSearch,
  Pencil,
  Settings2,
  Store,
} from "lucide-react";

import { ProductStatusBadge } from "@/components/catalogue/product-status";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, formatNumber } from "@/lib/formatters";
import { useAdminData } from "@/store/admin-data-provider";

import styles from "./catalogue.module.css";

export function ProductDetailScreen() {
  const params = useParams<{ productId: string }>();
  const searchParams = useSearchParams();
  const { products } = useAdminData();
  const product = products.find((item) => item.id === params.productId);
  const notice = searchParams.get("notice");

  if (!product) {
    return (
      <EmptyState
        icon={<PackageSearch size={25} aria-hidden="true" />}
        title="Product not found"
        description="This catalogue item may not exist in the current demo workspace."
        action={<Button href="/catalogue" variant="secondary">Back to catalogue</Button>}
      />
    );
  }

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="Catalogue product"
        title={product.name}
        description={product.scientificName || "No scientific name has been recorded."}
        breadcrumbs={[
          { label: "Catalogue", href: "/catalogue" },
          { label: product.name },
        ]}
        actions={
          <Button href={`/catalogue/${product.id}/edit`} icon={<Pencil size={16} aria-hidden="true" />}>
            Edit product
          </Button>
        }
      />

      {notice === "created" || notice === "updated" ? (
        <div className={styles.successBanner} role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <div>
            <strong>{notice === "created" ? "Product added" : "Changes saved"}</strong>
            <span>{product.name} is up to date in this demo workspace.</span>
          </div>
        </div>
      ) : null}

      <section className={styles.detailGrid} aria-label="Product overview">
        <Card className={styles.detailStat}>
          <span className={styles.detailStatIcon} aria-hidden="true"><CalendarClock size={20} /></span>
          <div><small>Typical shelf-life</small><strong>{product.shelfLifeDays} days</strong></div>
        </Card>
        <Card className={styles.detailStat}>
          <span className={styles.detailStatIcon} aria-hidden="true"><Store size={20} /></span>
          <div><small>Tenant coverage</small><strong>{product.tenantCoverage}</strong></div>
        </Card>
        <Card className={styles.detailStat}>
          <span className={styles.detailStatIcon} aria-hidden="true"><BarChart3 size={20} /></span>
          <div><small>Scans this month</small><strong>{formatNumber(product.scansThisMonth)}</strong></div>
        </Card>
      </section>

      <div className={styles.detailColumns}>
        <Card className={styles.detailCard}>
          <CardHeader title="Catalogue information" description="Core produce metadata used across the platform." />
          <dl className={styles.descriptionList}>
            <div><dt>Status</dt><dd><ProductStatusBadge status={product.status} /></dd></div>
            <div><dt>Common name</dt><dd>{product.name}</dd></div>
            <div><dt>Scientific name</dt><dd>{product.scientificName || "Not provided"}</dd></div>
            <div><dt>Category</dt><dd>{product.category}</dd></div>
            <div><dt>Last updated</dt><dd>{formatDate(product.updatedAt)}</dd></div>
            <div><dt>Catalogue ID</dt><dd><code>{product.id}</code></dd></div>
          </dl>
        </Card>

        <Card className={styles.ruleCard}>
          <span className={styles.ruleCardIcon} aria-hidden="true"><Clock3 size={22} /></span>
          <div>
            <p className={styles.eyebrow}>Static aging context</p>
            <h2>{product.shelfLifeDays}-day product reference</h2>
            <p>
              FreshLens uses configured shelf-life days as a lookup input when evaluating aging alerts. It does not predict a rot date or replace human inspection.
            </p>
            <Button href="/shelf-life" variant="secondary" icon={<Settings2 size={16} aria-hidden="true" />}>
              Manage category rules
            </Button>
          </div>
        </Card>
      </div>

      <Card className={styles.notesCard}>
        <span className={styles.notesIcon} aria-hidden="true"><Layers3 size={19} /></span>
        <div>
          <h2>Operational note</h2>
          <p>{product.note || "No operational note has been added for this catalogue product."}</p>
        </div>
      </Card>
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className={styles.pageStack} aria-busy="true" aria-label="Loading product">
      <div className={styles.skeletonTitle} />
      <div className={styles.skeletonGrid}>
        <div /><div /><div />
      </div>
      <div className={styles.skeletonPanel} />
    </div>
  );
}

