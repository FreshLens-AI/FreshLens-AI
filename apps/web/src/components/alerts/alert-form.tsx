"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BellPlus, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { PageHeader } from "@/components/ui/page-header";
import { useAdminData } from "@/store/admin-data-provider";
import type {
  Alert,
  AlertInput,
  AlertSeverity,
  AlertType,
} from "@/types/domain";

import {
  alertSeverityOptions,
  alertTypeOptions,
} from "./alert-options";
import styles from "./alerts.module.css";

interface AlertDraft {
  tenantId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  productId: string;
  batchReference: string;
}

type AlertDraftErrors = Partial<Record<keyof AlertDraft, string>>;

function makeDraft(alert?: Alert): AlertDraft {
  return {
    tenantId: alert?.tenantId ?? "",
    type: alert?.type ?? "other",
    severity: alert?.severity ?? "info",
    title: alert?.title ?? "",
    message: alert?.message ?? "",
    productId: alert?.productId ?? "",
    batchReference: alert?.batchReference ?? "",
  };
}

function validateDraft(
  draft: AlertDraft,
  tenantIds: Set<string>,
  productIds: Set<string>,
) {
  const errors: AlertDraftErrors = {};
  if (!draft.tenantId) errors.tenantId = "Choose the tenant receiving this alert.";
  else if (!tenantIds.has(draft.tenantId))
    errors.tenantId = "The selected tenant is no longer available.";

  if (draft.title.trim().length < 4)
    errors.title = "Enter a clear title using at least four characters.";
  else if (draft.title.trim().length > 100)
    errors.title = "Keep the title to 100 characters or fewer.";

  if (draft.message.trim().length < 10)
    errors.message = "Explain the condition using at least ten characters.";
  else if (draft.message.trim().length > 500)
    errors.message = "Keep the message to 500 characters or fewer.";

  if (draft.productId && !productIds.has(draft.productId))
    errors.productId = "The selected catalogue product is no longer available.";

  if (draft.batchReference.trim().length > 80)
    errors.batchReference = "Keep the batch reference to 80 characters or fewer.";

  return errors;
}

export function AlertForm({
  mode,
  alert,
}: {
  mode: "create" | "edit";
  alert?: Alert;
}) {
  const router = useRouter();
  const { tenants, products, createAlert, updateAlert } = useAdminData();
  const [draft, setDraft] = useState<AlertDraft>(() => makeDraft(alert));
  const [errors, setErrors] = useState<AlertDraftErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const editing = mode === "edit";

  const tenantIds = useMemo(
    () => new Set(tenants.map((tenant) => tenant.id)),
    [tenants],
  );
  const productIds = useMemo(
    () => new Set(products.map((product) => product.id)),
    [products],
  );
  const selectedType = alertTypeOptions.find(
    (option) => option.value === draft.type,
  );
  const selectedSeverity = alertSeverityOptions.find(
    (option) => option.value === draft.severity,
  );

  function update<K extends keyof AlertDraft>(key: K, value: AlertDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateDraft(draft, tenantIds, productIds);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    const input: AlertInput = {
      tenantId: draft.tenantId,
      type: draft.type,
      severity: draft.severity,
      status: alert?.status ?? "active",
      title: draft.title.trim(),
      message: draft.message.trim(),
      productId: draft.productId || undefined,
      batchReference: draft.batchReference.trim() || undefined,
    };

    if (editing && alert) {
      updateAlert(alert.id, input);
      router.push(`/alerts/${alert.id}`);
    } else {
      const created = createAlert(input);
      router.push(`/alerts/${created.id}`);
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Alert administration"
        title={editing ? "Edit alert" : "Create alert"}
        description={
          editing
            ? "Update the alert message and operational context. Lifecycle state is managed separately."
            : "Create a tenant-visible operational alert using the documented FreshLens alert types and severities."
        }
        breadcrumbs={[
          { label: "Alerts", href: "/alerts" },
          { label: editing ? alert?.title ?? "Edit" : "Create" },
        ]}
        actions={
          <Button
            href={alert ? `/alerts/${alert.id}` : "/alerts"}
            variant="secondary"
            icon={<ArrowLeft size={17} aria-hidden="true" />}
          >
            Cancel
          </Button>
        }
      />

      <form className={styles.formLayout} onSubmit={handleSubmit} noValidate>
        <div className={styles.formMain}>
          <Card className={styles.formCard}>
            <CardHeader
              title="Alert details"
              description="Choose who receives the alert and clearly describe the condition."
            />
            <div className={styles.formGrid}>
              <div className={styles.fullWidth}>
                <FormField
                  label="Tenant"
                  htmlFor="alert-tenant"
                  required
                  error={errors.tenantId}
                  hint="The vendor organisation that will see this alert."
                >
                  <select
                    id="alert-tenant"
                    className={styles.control}
                    value={draft.tenantId}
                    onChange={(event) => update("tenantId", event.target.value)}
                    aria-invalid={Boolean(errors.tenantId)}
                    aria-describedby={
                      errors.tenantId
                        ? "alert-tenant-error alert-tenant-hint"
                        : "alert-tenant-hint"
                    }
                  >
                    <option value="">Select a tenant</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name} · {tenant.status}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField
                label="Alert type"
                htmlFor="alert-type"
                required
                hint={selectedType?.description}
              >
                <select
                  id="alert-type"
                  className={styles.control}
                  value={draft.type}
                  onChange={(event) =>
                    update("type", event.target.value as AlertType)
                  }
                >
                  {alertTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                label="Severity"
                htmlFor="alert-severity"
                required
                hint={selectedSeverity?.description}
              >
                <select
                  id="alert-severity"
                  className={styles.control}
                  value={draft.severity}
                  onChange={(event) =>
                    update("severity", event.target.value as AlertSeverity)
                  }
                >
                  {alertSeverityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className={styles.fullWidth}>
                <FormField
                  label="Title"
                  htmlFor="alert-title"
                  required
                  error={errors.title}
                  hint={`${draft.title.length}/100 characters`}
                >
                  <input
                    id="alert-title"
                    className={styles.control}
                    value={draft.title}
                    maxLength={100}
                    placeholder="Example: Shelf-life rule triggered"
                    onChange={(event) => update("title", event.target.value)}
                    aria-invalid={Boolean(errors.title)}
                  />
                </FormField>
              </div>

              <div className={styles.fullWidth}>
                <FormField
                  label="Message"
                  htmlFor="alert-message"
                  required
                  error={errors.message}
                  hint={`${draft.message.length}/500 characters · Include enough context for the vendor to act.`}
                >
                  <textarea
                    id="alert-message"
                    className={`${styles.control} ${styles.textarea}`}
                    value={draft.message}
                    maxLength={500}
                    rows={6}
                    placeholder="Describe what happened, why it matters, and the recommended next step."
                    onChange={(event) => update("message", event.target.value)}
                    aria-invalid={Boolean(errors.message)}
                  />
                </FormField>
              </div>
            </div>
          </Card>

          <Card className={styles.formCard}>
            <CardHeader
              title="Optional produce context"
              description="Link a catalogue product or add a display-safe batch reference when it helps the vendor act."
            />
            <div className={styles.formGrid}>
              <FormField
                label="Catalogue product"
                htmlFor="alert-product"
                error={errors.productId}
                hint="Optional. The alert remains valid without a product."
              >
                <select
                  id="alert-product"
                  className={styles.control}
                  value={draft.productId}
                  onChange={(event) => update("productId", event.target.value)}
                  aria-invalid={Boolean(errors.productId)}
                >
                  <option value="">No linked product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · {product.category}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                label="Batch reference"
                htmlFor="alert-batch"
                error={errors.batchReference}
                hint="Optional reference only; the admin UI does not expose raw batch inventory."
              >
                <input
                  id="alert-batch"
                  className={styles.control}
                  value={draft.batchReference}
                  maxLength={80}
                  placeholder="Example: Batch ••A184"
                  onChange={(event) =>
                    update("batchReference", event.target.value)
                  }
                  aria-invalid={Boolean(errors.batchReference)}
                />
              </FormField>
            </div>
          </Card>
        </div>

        <aside className={styles.formAside}>
          <Card className={styles.previewCard}>
            <span className={styles.previewIcon} aria-hidden="true">
              <BellPlus size={21} />
            </span>
            <p className={styles.previewEyebrow}>Lifecycle</p>
            <h2>{editing ? "State stays unchanged" : "Starts as active"}</h2>
            <p>
              {editing
                ? `This alert remains ${alert?.status ?? "active"}. Use the detail page to acknowledge or dismiss it.`
                : "New alerts enter the active queue. Acknowledgement and dismissal require separate confirmation."}
            </p>
          </Card>

          <Card className={styles.guidanceCard}>
            <h2>Before saving</h2>
            <ul>
              <li>Use only Spoilage, Low stock, Aging, or Other.</li>
              <li>Do not include private scan images or raw inventory data.</li>
              <li>Dismissing later keeps the record in history.</li>
            </ul>
          </Card>

          <Button
            type="submit"
            className={styles.submitButton}
            icon={<Save size={17} aria-hidden="true" />}
            disabled={submitting}
          >
            {submitting
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Create alert"}
          </Button>
        </aside>
      </form>
    </div>
  );
}
