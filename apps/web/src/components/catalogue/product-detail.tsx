"use client";

import { useParams } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  Clock3,
  PackageSearch,
  Store,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, formatNumber } from "@/lib/formatters";
import { useAdminData } from "@/store/admin-data-provider";

import styles from "./catalogue.module.css";

export function ProductDetailScreen() {
  const params = useParams<{ productId: string }>();
  const { products } = useAdminData();
  const product = products.find((item) => item.id === params.productId);

  if (!product) {
    return (
      <EmptyState
        icon={<PackageSearch size={25} aria-hidden="true" />}
        title="Product not found"
        description="This product was not returned by the admin API."
        action={<Button href="/catalogue" variant="secondary">Back to catalogue</Button>}
      />
    );
  }

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="Catalogue product"
        title={product.name}
        description="Shared product configuration available to every tenant."
        breadcrumbs={[
          { label: "Catalogue", href: "/catalogue" },
          { label: product.name },
        ]}
      />

      <section className={styles.detailGrid} aria-label="Product overview">
        <Card className={styles.detailStat}>
          <span className={styles.detailStatIcon} aria-hidden="true"><CalendarClock size={20} /></span>
          <div><small>Fresh → medium</small><strong>{product.freshToMediumDays === null ? "Not set" : `${product.freshToMediumDays} days`}</strong></div>
        </Card>
        <Card className={styles.detailStat}>
          <span className={styles.detailStatIcon} aria-hidden="true"><CalendarClock size={20} /></span>
          <div><small>Medium → spoiled</small><strong>{product.mediumToSpoiledDays === null ? "Not set" : `${product.mediumToSpoiledDays} days`}</strong></div>
        </Card>
        <Card className={styles.detailStat}>
          <span className={styles.detailStatIcon} aria-hidden="true"><Store size={20} /></span>
          <div><small>Low-stock threshold</small><strong>{formatNumber(product.lowStockThreshold)}</strong></div>
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
            <div><dt>Common name</dt><dd>{product.name}</dd></div>
            <div><dt>Scope</dt><dd>All tenants</dd></div>
            <div><dt>Last updated</dt><dd>{formatDate(product.updatedAt)}</dd></div>
            <div><dt>Catalogue ID</dt><dd><code>{product.id}</code></dd></div>
          </dl>
        </Card>

        <Card className={styles.ruleCard}>
          <span className={styles.ruleCardIcon} aria-hidden="true"><Clock3 size={22} /></span>
          <div>
            <p className={styles.eyebrow}>Shared aging context</p>
            <h2>{product.shelfLifeDays}-day total shelf life</h2>
            <p>
              The category rule applies to all retailers. FreshLens uses the combined duration for aging alerts. These are estimates and do not replace inspection.
            </p>
            <Button href="/catalogue" variant="secondary">
              Back to catalogue
            </Button>
          </div>
        </Card>
      </div>

    </div>
  );
}
