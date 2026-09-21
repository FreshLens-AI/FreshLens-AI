"use client";

import { useMemo, useState } from "react";
import { Clock3, Info, Search, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, formatNumber } from "@/lib/formatters";
import { useAdminData } from "@/store/admin-data-provider";

import styles from "./catalogue.module.css";

export function ShelfLifeScreen() {
  const { products, shelfLifeRules } = useAdminData();
  const [query, setQuery] = useState("");
  const filteredRules = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return shelfLifeRules.filter((rule) =>
      rule.category.toLocaleLowerCase().includes(normalized),
    );
  }, [query, shelfLifeRules]);
  const dayValues = shelfLifeRules.map((rule) => rule.defaultDays);
  const range = dayValues.length
    ? `${Math.min(...dayValues)}–${Math.max(...dayValues)} days`
    : "Not configured";

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="Aging alert configuration"
        title="Shelf-life values"
        description="Read-only shelf-life values currently configured by tenants and returned by the admin API."
        actions={<Button href="/catalogue" variant="secondary">View catalogue</Button>}
      />

      <Card className={styles.explainerCard}>
        <span className={styles.explainerIcon} aria-hidden="true"><Clock3 size={23} /></span>
        <div>
          <h2>How V1 static aging works</h2>
          <p>A batch can raise an aging alert when time since intake exceeds its product shelf-life while stock remains. These are lookup values—not learned spoilage predictions.</p>
          <div className={styles.scopeNote}>
            <Info size={16} aria-hidden="true" />
            <span>Editing is unavailable until a dedicated admin write API is added.</span>
          </div>
        </div>
      </Card>

      <section className={styles.summaryGrid} aria-label="Shelf-life summary">
        <Card className={styles.summaryCard}><span>Configured products</span><strong>{formatNumber(shelfLifeRules.length)}</strong><small>Tenant product values</small></Card>
        <Card className={styles.summaryCard}><span>Products covered</span><strong>{formatNumber(products.length)}</strong><small>Live catalogue rows</small></Card>
        <Card className={styles.summaryCard}><span>Configured range</span><strong>{range}</strong><small>Across tenant products</small></Card>
      </section>

      <Card className={styles.rulesCard}>
        <CardHeader
          title="Tenant product values"
          description="Each row is a live product configuration returned by the admin API."
          action={
            <div className={styles.compactSearch}>
              <Search size={16} aria-hidden="true" />
              <label htmlFor="rule-search" className={styles.srOnly}>Search shelf-life values</label>
              <input id="rule-search" type="search" placeholder="Search product or tenant" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          }
        />

        {filteredRules.length ? (
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.ruleTable}`}>
              <caption className={styles.srOnly}>Live tenant product shelf-life values</caption>
              <thead><tr><th scope="col">Product and tenant</th><th scope="col">Last updated</th><th scope="col">Static aging value</th></tr></thead>
              <tbody>
                {filteredRules.map((rule) => (
                  <tr key={rule.id}>
                    <td><span className={styles.ruleCategory}><span aria-hidden="true"><Settings2 size={16} /></span><strong>{rule.category}</strong></span></td>
                    <td>{formatDate(rule.updatedAt)}</td>
                    <td><strong>{rule.defaultDays} days</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.embeddedEmpty}>
            <EmptyState
              icon={<Search size={23} aria-hidden="true" />}
              title={shelfLifeRules.length ? "No values match this search" : "No shelf-life values configured"}
              description={shelfLifeRules.length ? "Try a broader product or tenant search." : "Values will appear after vendors add products."}
              action={query ? <Button variant="secondary" onClick={() => setQuery("")}>Clear search</Button> : undefined}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
