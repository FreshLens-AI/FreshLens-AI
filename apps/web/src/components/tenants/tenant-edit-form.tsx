"use client";

import { notFound, useRouter } from "next/navigation";
import { Save, ShieldCheck } from "lucide-react";
import { FormEvent, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { PageHeader } from "@/components/ui/page-header";
import { useAdminData } from "@/store/admin-data-provider";
import type { Tenant, TenantStatus } from "@/types/domain";

import styles from "./tenants.module.css";

interface FormErrors {
  name?: string;
  status?: string;
}

function validate(name: string, status: string): FormErrors {
  const errors: FormErrors = {};
  const normalizedName = name.trim();

  if (!normalizedName) {
    errors.name = "Enter an organization name.";
  } else if (normalizedName.length < 2) {
    errors.name = "Organization name must contain at least 2 characters.";
  } else if (normalizedName.length > 80) {
    errors.name = "Organization name must be 80 characters or fewer.";
  }

  if (status !== "active" && status !== "inactive") {
    errors.status = "Select a valid tenant status.";
  }

  return errors;
}

export function TenantEditForm({ tenantId }: { tenantId: string }) {
  const { tenants } = useAdminData();
  const tenant = tenants.find((item) => item.id === tenantId);

  if (!tenant) notFound();

  return (
    <TenantEditFormContent
      key={`${tenant.id}:${tenant.name}:${tenant.status}`}
      tenant={tenant}
    />
  );
}

function TenantEditFormContent({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const { updateTenant } = useAdminData();
  const [name, setName] = useState(tenant?.name ?? "");
  const [status, setStatus] = useState<TenantStatus>(tenant?.status ?? "active");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isNavigating, startNavigation] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(name, status);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    updateTenant(tenant.id, {
      name: name.trim(),
      status,
      ownerName: tenant.ownerName,
      email: tenant.email,
      phone: tenant.phone,
      city: tenant.city,
      plan: tenant.plan,
    });

    startNavigation(() => {
      router.push(`/tenants/${tenant.id}?updated=1`);
    });
  }

  return (
    <div className={styles.pageStack}>
      <PageHeader
        breadcrumbs={[
          { label: "Tenants", href: "/tenants" },
          { label: tenant.name, href: `/tenants/${tenant.id}` },
          { label: "Edit" },
        ]}
        eyebrow="Tenant profile"
        title={`Edit ${tenant.name}`}
        description="Update the V1 profile fields used for platform operation."
      />

      <form className={styles.editLayout} onSubmit={handleSubmit} noValidate>
        <Card className={styles.formCard}>
          <CardHeader
            title="Profile fields"
            description="Organization name and status are the documented editable fields for V1."
          />

          <div className={styles.formFields}>
            <FormField
              label="Organization name"
              htmlFor="tenant-name"
              required
              error={errors.name}
              hint="Use the vendor organization's public operating name."
            >
              <input
                id="tenant-name"
                className={styles.input}
                value={name}
                maxLength={80}
                autoComplete="organization"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={
                  errors.name ? "tenant-name-hint tenant-name-error" : "tenant-name-hint"
                }
                onChange={(event) => {
                  setName(event.target.value);
                  if (errors.name) setErrors((value) => ({ ...value, name: undefined }));
                }}
              />
            </FormField>

            <FormField
              label="Tenant status"
              htmlFor="tenant-edit-status"
              required
              error={errors.status}
              hint="Inactive tenants remain visible, but are marked unavailable for platform operation."
            >
              <select
                id="tenant-edit-status"
                className={styles.input}
                value={status}
                aria-invalid={Boolean(errors.status)}
                aria-describedby={
                  errors.status
                    ? "tenant-edit-status-hint tenant-edit-status-error"
                    : "tenant-edit-status-hint"
                }
                onChange={(event) => {
                  setStatus(event.target.value as TenantStatus);
                  if (errors.status) setErrors((value) => ({ ...value, status: undefined }));
                }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FormField>
          </div>

          <div className={styles.formActions}>
            <Button
              href={`/tenants/${tenant.id}`}
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isNavigating}
              icon={<Save size={16} aria-hidden="true" />}
            >
              {isNavigating ? "Saving…" : "Save changes"}
            </Button>
          </div>
          {isNavigating ? (
            <p className={styles.srOnly} role="status">
              Profile saved. Opening tenant details.
            </p>
          ) : null}
        </Card>

        <aside className={styles.editAside}>
          <Card className={styles.contextCard}>
            <CardHeader title="Read-only context" />
            <dl>
              <div><dt>Primary contact</dt><dd>{tenant.ownerName}</dd></div>
              <div><dt>Email</dt><dd>{tenant.email}</dd></div>
              <div><dt>Location</dt><dd>{tenant.city}</dd></div>
              <div><dt>Plan</dt><dd>{tenant.plan}</dd></div>
            </dl>
          </Card>
          <div className={styles.privacyPanel}>
            <ShieldCheck size={20} aria-hidden="true" />
            <div>
              <strong>Privacy boundary</strong>
              <p>
                Editing this profile does not grant access to vendor scans,
                images, batches, or inventory records.
              </p>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
