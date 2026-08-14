"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Info,
  RotateCcw,
  Search,
  Settings2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, formatNumber } from "@/lib/formatters";
import { useAdminData } from "@/store/admin-data-provider";
import type { ShelfLifeRule } from "@/types/domain";

import styles from "./catalogue.module.css";

function RuleEditor({
  rule,
  onSave,
}: {
  rule: ShelfLifeRule;
  onSave: (id: string, days: number, category: string) => void;
}) {
  const [days, setDays] = useState(String(rule.defaultDays));
  const [error, setError] = useState("");
  const changed = days !== String(rule.defaultDays);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(days);
    if (!days.trim() || !Number.isInteger(value) || value < 1) {
      setError("Enter a positive whole number of days.");
      return;
    }
    setError("");
    onSave(rule.id, value, rule.category);
  }

  function reset() {
    setDays(String(rule.defaultDays));
    setError("");
  }

  return (
    <form className={styles.ruleForm} onSubmit={handleSubmit} noValidate>
      <div className={styles.ruleDaysInput}>
        <label htmlFor={`rule-${rule.id}`}>Typical shelf-life for {rule.category}</label>
        <input
          id={`rule-${rule.id}`}
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={days}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `rule-${rule.id}-error` : undefined}
          onChange={(event) => {
            setDays(event.target.value);
            setError("");
          }}
        />
        <span>days</span>
      </div>
      <div className={styles.ruleButtons}>
        {changed ? (
          <button type="button" className={styles.resetIconButton} onClick={reset} aria-label={`Reset ${rule.category} shelf-life`} title="Reset value">
            <RotateCcw size={15} aria-hidden="true" />
          </button>
        ) : null}
        <Button type="submit" size="sm" disabled={!changed}>Save rule</Button>
      </div>
      {error ? <p id={`rule-${rule.id}-error`} className={styles.inlineError} role="alert">{error}</p> : null}
    </form>
  );
}

export function ShelfLifeScreen() {
  const { products, shelfLifeRules, updateShelfLifeRule } = useAdminData();
  const [query, setQuery] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const filteredRules = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return shelfLifeRules.filter((rule) =>
      rule.category.toLocaleLowerCase().includes(normalized),
    );
  }, [query, shelfLifeRules]);

  const coveredProducts = shelfLifeRules.reduce((sum, rule) => sum + rule.productCount, 0);
  const dayValues = shelfLifeRules.map((rule) => rule.defaultDays);
  const range = dayValues.length > 0
    ? `${Math.min(...dayValues)}–${Math.max(...dayValues)} days`
    : "Not configured";

  function saveRule(id: string, days: number, category: string) {
    updateShelfLifeRule(id, days);
    setSavedMessage(`${category} now uses a ${days}-day static aging rule.`);
  }

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="Aging alert configuration"
        title="Shelf-life rules"
        description="Set platform category defaults used by FreshLens static aging evaluations."
        actions={<Button href="/catalogue" variant="secondary">View catalogue</Button>}
      />

      <Card className={styles.explainerCard}>
        <span className={styles.explainerIcon} aria-hidden="true"><Clock3 size={23} /></span>
        <div>
          <h2>How V1 static aging works</h2>
          <p>
            A batch can raise an aging alert when time since intake exceeds its configured typical shelf-life while a large proportion of received stock remains unsold. These values are lookup rules—not learned spoilage predictions.
          </p>
          <div className={styles.scopeNote}>
            <Info size={16} aria-hidden="true" />
            <span>Low-stock thresholds remain vendor-configurable and are not managed on this admin screen.</span>
          </div>
        </div>
      </Card>

      <section className={styles.summaryGrid} aria-label="Shelf-life rule summary">
        <Card className={styles.summaryCard}>
          <span>Configured categories</span>
          <strong>{formatNumber(shelfLifeRules.length)}</strong>
          <small>Platform-level category defaults</small>
        </Card>
        <Card className={styles.summaryCard}>
          <span>Products covered</span>
          <strong>{formatNumber(coveredProducts)}</strong>
          <small>of {formatNumber(products.length)} catalogue products</small>
        </Card>
        <Card className={styles.summaryCard}>
          <span>Configured range</span>
          <strong>{range}</strong>
          <small>Across all category rules</small>
        </Card>
      </section>

      <Card className={styles.rulesCard}>
        <CardHeader
          title="Category defaults"
          description="Edit one category at a time. Changes are retained in this local demo workspace."
          action={
            <div className={styles.compactSearch}>
              <Search size={16} aria-hidden="true" />
              <label htmlFor="rule-search" className={styles.srOnly}>Search category rules</label>
              <input
                id="rule-search"
                type="search"
                placeholder="Search categories"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          }
        />

        <p className={styles.saveAnnouncement} aria-live="polite">
          {savedMessage ? <><CheckCircle2 size={16} aria-hidden="true" /> {savedMessage}</> : null}
        </p>

        {filteredRules.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.ruleTable}`}>
              <caption className={styles.srOnly}>Administrator-configured shelf-life rules</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Catalogue coverage</th>
                  <th scope="col">Last updated</th>
                  <th scope="col">Static aging value</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <span className={styles.ruleCategory}>
                        <span aria-hidden="true"><Settings2 size={16} /></span>
                        <strong>{rule.category}</strong>
                      </span>
                    </td>
                    <td>{rule.productCount} {rule.productCount === 1 ? "product" : "products"}</td>
                    <td>{formatDate(rule.updatedAt)}</td>
                    <td><RuleEditor rule={rule} onSave={saveRule} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.embeddedEmpty}>
            <EmptyState
              icon={shelfLifeRules.length === 0
                ? <AlertTriangle size={23} aria-hidden="true" />
                : <Search size={23} aria-hidden="true" />}
              title={shelfLifeRules.length === 0 ? "No shelf-life rules configured" : "No category rules found"}
              description={shelfLifeRules.length === 0
                ? "Static aging alerts need at least one positive shelf-life rule."
                : "Try a broader category search."}
              action={query ? <Button variant="secondary" onClick={() => setQuery("")}>Clear search</Button> : undefined}
            />
          </div>
        )}
      </Card>

      <div className={styles.cautionNote}>
        <AlertTriangle size={17} aria-hidden="true" />
        <p><strong>Assistive configuration:</strong> Shelf-life rules support stock review decisions and do not certify produce as safe or saleable.</p>
      </div>
    </div>
  );
}

