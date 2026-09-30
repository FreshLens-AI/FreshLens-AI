"use client";

import { useActionState } from "react";

import { createTenant, type CreateTenantState } from "@/app/(admin)/tenants/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import styles from "./tenants.module.css";

const initialState: CreateTenantState = { status: null, message: "" };

export function CreateTenantForm() {
  const [state, action, pending] = useActionState(createTenant, initialState);
  return (
    <Card className={styles.createCard}>
      <div>
        <h2>Create tenant</h2>
        <p>The contact will receive an email link to set a password in the vendor app.</p>
      </div>
      <form action={action} className={styles.createForm}>
        <label>Tenant name<input name="name" required maxLength={120} placeholder="Example Grocer" /></label>
        <label>Contact name<input name="vendor_name" required maxLength={120} placeholder="Store owner" /></label>
        <label>Contact email<input name="vendor_email" type="email" required maxLength={254} placeholder="owner@example.com" /></label>
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create and invite"}</Button>
      </form>
      {state.message ? <p role={state.status === "error" ? "alert" : "status"}
        className={state.status === "error" ? styles.createError : styles.createSuccess}>{state.message}</p> : null}
    </Card>
  );
}
