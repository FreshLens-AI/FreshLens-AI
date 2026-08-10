"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";

import {
  loginAction,
  type LoginState,
} from "@/app/(auth)/actions";

import styles from "./login.module.css";

const initialState: LoginState = {};

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className={styles.form} noValidate>
      {state.message ? (
        <div className={styles.formError} role="alert">
          {state.message}
        </div>
      ) : null}

      <div className={styles.field}>
        <label htmlFor="admin-email">Email address</label>
        <div className={styles.inputWrap}>
          <Mail size={18} aria-hidden="true" />
          <input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="admin@freshlens.ai"
            aria-invalid={Boolean(state.fieldErrors?.email)}
            aria-describedby={
              state.fieldErrors?.email ? "admin-email-error" : undefined
            }
            disabled={!configured || pending}
          />
        </div>
        {state.fieldErrors?.email ? (
          <p id="admin-email-error" className={styles.fieldError}>
            {state.fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label htmlFor="admin-password">Password</label>
          <span>Supabase protected</span>
        </div>
        <div className={styles.inputWrap}>
          <LockKeyhole size={18} aria-hidden="true" />
          <input
            id="admin-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={Boolean(state.fieldErrors?.password)}
            aria-describedby={
              state.fieldErrors?.password ? "admin-password-error" : undefined
            }
            disabled={!configured || pending}
          />
          <button
            type="button"
            className={styles.reveal}
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            disabled={!configured || pending}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {state.fieldErrors?.password ? (
          <p id="admin-password-error" className={styles.fieldError}>
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        className={styles.submit}
        disabled={!configured || pending}
      >
        {pending ? (
          <>
            <LoaderCircle className={styles.spinner} size={18} />
            Signing in…
          </>
        ) : (
          "Sign in to admin workspace"
        )}
      </button>
    </form>
  );
}
