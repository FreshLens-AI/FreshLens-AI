"use client";

import { useActionState, type ReactNode } from "react";
import { Building2, LoaderCircle, Mail, Phone, UserRound } from "lucide-react";

import {
  submitTenantApplication,
  type SignupState,
} from "@/app/(auth)/signup/actions";

import styles from "./login.module.css";

const initialState: SignupState = { status: null, message: "" };

export function SignupForm() {
  const [state, action, pending] = useActionState(submitTenantApplication, initialState);
  if (state.status === "success") {
    return <div className={styles.successMessage} role="status">{state.message}</div>;
  }

  const field = (
    name: "organization" | "name" | "email" | "phone",
    label: string,
    icon: ReactNode,
    options: { type?: string; required?: boolean; placeholder: string; autoComplete?: string },
  ) => (
    <div className={styles.field}>
      <label htmlFor={`signup-${name}`}>{label}</label>
      <div className={styles.inputWrap}>
        {icon}
        <input
          id={`signup-${name}`}
          name={name}
          type={options.type ?? "text"}
          required={options.required}
          maxLength={name === "email" ? 254 : name === "phone" ? 40 : 120}
          placeholder={options.placeholder}
          autoComplete={options.autoComplete}
          aria-invalid={Boolean(state.fieldErrors?.[name])}
          aria-describedby={state.fieldErrors?.[name] ? `signup-${name}-error` : undefined}
          disabled={pending}
        />
      </div>
      {state.fieldErrors?.[name] ? (
        <p id={`signup-${name}-error`} className={styles.fieldError}>{state.fieldErrors[name]}</p>
      ) : null}
    </div>
  );

  return (
    <form action={action} className={styles.form} noValidate>
      {state.message ? <div className={styles.formError} role="alert">{state.message}</div> : null}
      {field("organization", "Store or organization", <Building2 size={18} />, {
        required: true, placeholder: "Example Grocer", autoComplete: "organization",
      })}
      {field("name", "Owner name", <UserRound size={18} />, {
        required: true, placeholder: "Your full name", autoComplete: "name",
      })}
      {field("email", "Owner email", <Mail size={18} />, {
        type: "email", required: true, placeholder: "owner@example.com", autoComplete: "email",
      })}
      {field("phone", "Phone (optional)", <Phone size={18} />, {
        type: "tel", placeholder: "+94 77 123 4567", autoComplete: "tel",
      })}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? <><LoaderCircle className={styles.spinner} size={18} />Submitting…</> : "Submit for review"}
      </button>
    </form>
  );
}
