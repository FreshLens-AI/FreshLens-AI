"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Leaf, PackageSearch, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { PageHeader } from "@/components/ui/page-header";
import { useAdminData } from "@/store/admin-data-provider";
import type { Product, ProductInput, ProductStatus } from "@/types/domain";

import styles from "./catalogue.module.css";

interface FormValues {
  name: string;
  scientificName: string;
  category: string;
  shelfLifeDays: string;
  status: ProductStatus;
  note: string;
}

type FormErrors = Partial<Record<keyof FormValues, string>>;

function valuesFromProduct(product?: Product): FormValues {
  return {
    name: product?.name ?? "",
    scientificName: product?.scientificName ?? "",
    category: product?.category ?? "",
    shelfLifeDays: product ? String(product.shelfLifeDays) : "",
    status: product?.status ?? "draft",
    note: product?.note ?? "",
  };
}

function describe(field: keyof FormValues, hasHint: boolean, error?: string) {
  return [hasHint ? `product-${field}-hint` : "", error ? `product-${field}-error` : ""]
    .filter(Boolean)
    .join(" ") || undefined;
}

export function ProductFormScreen({ mode }: { mode: "create" | "edit" }) {
  const params = useParams<{ productId: string }>();
  const router = useRouter();
  const { createProduct, products, updateProduct } = useAdminData();
  const product = mode === "edit"
    ? products.find((item) => item.id === params.productId)
    : undefined;
  const [values, setValues] = useState<FormValues>(() => valuesFromProduct(product));
  const [errors, setErrors] = useState<FormErrors>({});
  const [isPending, startTransition] = useTransition();

  const categories = useMemo(
    () => [...new Set(products.map((item) => item.category))].sort(),
    [products],
  );

  if (mode === "edit" && !product) {
    return (
      <EmptyState
        icon={<PackageSearch size={25} aria-hidden="true" />}
        title="Product not found"
        description="This catalogue item may not exist in the current demo workspace."
        action={<Button href="/catalogue" variant="secondary">Back to catalogue</Button>}
      />
    );
  }

  function setField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate() {
    const nextErrors: FormErrors = {};
    const name = values.name.trim();
    const category = values.category.trim();
    const days = Number(values.shelfLifeDays);

    if (!name) nextErrors.name = "Enter a product name.";
    if (!category) nextErrors.category = "Enter a product category.";
    if (!values.shelfLifeDays.trim()) {
      nextErrors.shelfLifeDays = "Enter the typical shelf-life in days.";
    } else if (!Number.isInteger(days) || days < 1) {
      nextErrors.shelfLifeDays = "Shelf-life must be a positive whole number.";
    }
    if (values.note.length > 400) {
      nextErrors.note = "Keep the catalogue note to 400 characters or fewer.";
    }

    const duplicate = products.find(
      (item) =>
        item.name.toLocaleLowerCase() === name.toLocaleLowerCase() &&
        item.id !== product?.id,
    );
    if (name && duplicate) {
      nextErrors.name = `${duplicate.name} is already in the catalogue.`;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    const input: ProductInput = {
      name: values.name.trim(),
      scientificName: values.scientificName.trim() || undefined,
      category: values.category.trim(),
      shelfLifeDays: Number(values.shelfLifeDays),
      status: values.status,
      note: values.note.trim() || undefined,
    };

    startTransition(() => {
      if (mode === "create") {
        const created = createProduct(input);
        router.push(`/catalogue/${created.id}?notice=created`);
      } else if (product) {
        updateProduct(product.id, input);
        router.push(`/catalogue/${product.id}?notice=updated`);
      }
    });
  }

  const title = mode === "create" ? "Add catalogue product" : `Edit ${product?.name}`;
  const description = mode === "create"
    ? "Create a produce type with the metadata FreshLens uses across inventory and classification views."
    : "Update the catalogue metadata and product-specific shelf-life reference.";

  return (
    <div className={styles.pageStack}>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[
          { label: "Catalogue", href: "/catalogue" },
          { label: mode === "create" ? "Add product" : `Edit ${product?.name}` },
        ]}
      />

      <form className={styles.formLayout} onSubmit={handleSubmit} noValidate>
        <div className={styles.formMain}>
          <Card className={styles.formCard}>
            <CardHeader
              title="Product identity"
              description="Use clear names that platform operators and vendors can recognize."
            />
            <div className={styles.formGrid}>
              <FormField
                label="Product name"
                htmlFor="product-name"
                required
                error={errors.name}
              >
                <input
                  className={styles.control}
                  id="product-name"
                  name="name"
                  value={values.name}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={describe("name", false, errors.name)}
                  onChange={(event) => setField("name", event.target.value)}
                />
              </FormField>

              <FormField
                label="Scientific name"
                htmlFor="product-scientificName"
                hint="Optional, but useful when common produce names overlap."
              >
                <input
                  className={styles.control}
                  id="product-scientificName"
                  name="scientificName"
                  value={values.scientificName}
                  autoComplete="off"
                  aria-describedby={describe("scientificName", true)}
                  onChange={(event) => setField("scientificName", event.target.value)}
                />
              </FormField>

              <FormField
                label="Category"
                htmlFor="product-category"
                required
                hint="Use an existing category when possible so shelf-life rules remain consistent."
                error={errors.category}
              >
                <input
                  className={styles.control}
                  id="product-category"
                  name="category"
                  list="product-categories"
                  value={values.category}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.category)}
                  aria-describedby={describe("category", true, errors.category)}
                  onChange={(event) => setField("category", event.target.value)}
                />
                <datalist id="product-categories">
                  {categories.map((category) => <option value={category} key={category} />)}
                </datalist>
              </FormField>

              <FormField label="Catalogue status" htmlFor="product-status" required>
                <select
                  className={styles.control}
                  id="product-status"
                  name="status"
                  value={values.status}
                  onChange={(event) => setField("status", event.target.value as ProductStatus)}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </FormField>
            </div>
          </Card>

          <Card className={styles.formCard}>
            <CardHeader
              title="Aging-rule context"
              description="This is a static lookup value, not an AI-predicted spoilage date."
            />
            <div className={styles.formGrid}>
              <FormField
                label="Typical shelf-life"
                htmlFor="product-shelfLifeDays"
                required
                hint="Enter a positive whole number of days. Category defaults are managed separately under Shelf-life rules."
                error={errors.shelfLifeDays}
              >
                <div className={styles.numberControl}>
                  <input
                    id="product-shelfLifeDays"
                    name="shelfLifeDays"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={values.shelfLifeDays}
                    aria-invalid={Boolean(errors.shelfLifeDays)}
                    aria-describedby={describe("shelfLifeDays", true, errors.shelfLifeDays)}
                    onChange={(event) => setField("shelfLifeDays", event.target.value)}
                  />
                  <span>days</span>
                </div>
              </FormField>

              <FormField
                label="Catalogue note"
                htmlFor="product-note"
                hint={`${values.note.length}/400 characters · Optional operational guidance only.`}
                error={errors.note}
              >
                <textarea
                  className={styles.textarea}
                  id="product-note"
                  name="note"
                  rows={5}
                  maxLength={420}
                  value={values.note}
                  aria-invalid={Boolean(errors.note)}
                  aria-describedby={describe("note", true, errors.note)}
                  onChange={(event) => setField("note", event.target.value)}
                />
              </FormField>
            </div>
          </Card>
        </div>

        <aside className={styles.formAside} aria-label="Save catalogue product">
          <Card className={styles.saveCard}>
            <span className={styles.saveIcon} aria-hidden="true"><Leaf size={20} /></span>
            <h2>{mode === "create" ? "Ready to add this product?" : "Review your changes"}</h2>
            <p>
              Product deletion is intentionally unavailable. Archived products remain available for audit-friendly catalogue history.
            </p>
            <div className={styles.saveActions}>
              <Button type="submit" disabled={isPending} icon={<Save size={16} aria-hidden="true" />}>
                {isPending ? "Saving…" : mode === "create" ? "Add product" : "Save changes"}
              </Button>
              <Button href={product ? `/catalogue/${product.id}` : "/catalogue"} variant="secondary" icon={<ArrowLeft size={16} aria-hidden="true" />}>
                Cancel
              </Button>
            </div>
            <p className={styles.pendingMessage} aria-live="polite">
              {isPending ? <><CheckCircle2 size={15} aria-hidden="true" /> Saving catalogue changes…</> : null}
            </p>
          </Card>
        </aside>
      </form>
    </div>
  );
}

