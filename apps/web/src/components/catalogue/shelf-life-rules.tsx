"use client";

import { useActionState } from "react";

import { updateCategoryShelfLife, type ShelfLifeActionState } from "@/app/(admin)/catalogue/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CategoryShelfLife } from "@/types/domain";

import styles from "./catalogue.module.css";

const initialState: ShelfLifeActionState = { status: null, message: "" };

function ShelfLifeRuleForm({ rule }: { rule: CategoryShelfLife }) {
  const [state, action, pending] = useActionState(
    updateCategoryShelfLife.bind(null, rule.category), initialState,
  );
  const name = rule.category[0].toUpperCase() + rule.category.slice(1);
  const total = rule.freshToMediumDays !== null && rule.mediumToSpoiledDays !== null
    ? rule.freshToMediumDays + rule.mediumToSpoiledDays
    : null;

  return (
    <Card className={styles.shelfLifeRule}>
      <div className={styles.ruleHeading}>
        <h3>{name}</h3>
        <span>{total === null ? "Needs configuration" : `${total} days total`}</span>
      </div>
      <form action={action} className={styles.ruleForm}>
        <label>
          Fresh → medium (days)
          <input type="number" name="fresh_to_medium_days" min="1" max="3650" step="1"
            defaultValue={rule.freshToMediumDays ?? ""} required />
        </label>
        <label>
          Medium → spoiled (days)
          <input type="number" name="medium_to_spoiled_days" min="1" max="3650" step="1"
            defaultValue={rule.mediumToSpoiledDays ?? ""} required />
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save rule"}
        </Button>
      </form>
      <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? styles.ruleError : styles.ruleMessage}>
        {state.message}
      </p>
    </Card>
  );
}

export function ShelfLifeRules({ rules }: { rules: CategoryShelfLife[] }) {
  return (
    <section aria-labelledby="shelf-life-heading" className={styles.rulesSection}>
      <div>
        <h2 id="shelf-life-heading">Shelf life by product category</h2>
        <p>Set each stage duration once for all retailers. The combined duration becomes the product shelf life used for aging alerts.</p>
      </div>
      <div className={styles.rulesGrid}>
        {rules.map((rule) => <ShelfLifeRuleForm key={rule.category} rule={rule} />)}
      </div>
    </section>
  );
}
