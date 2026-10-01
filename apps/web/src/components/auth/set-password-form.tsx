"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import styles from "./login.module.css";

export function SetPasswordForm() {
  const router = useRouter();
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("Opening your secure invitation…");

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const activate = async () => {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
      const invitationError = fragment.get("error_description");
      if (invitationError) {
        setMessage("This invitation is invalid or has expired. Ask an administrator for a new invitation.");
        return;
      }

      let error: Error | null = null;
      if (code) {
        ({ error } = await supabase.auth.exchangeCodeForSession(code));
      } else {
        const accessToken = fragment.get("access_token");
        const refreshToken = fragment.get("refresh_token");
        if (accessToken && refreshToken) {
          ({ error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }));
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) error = new Error("Invitation session is missing.");
        }
      }

      if (error) {
        setMessage("This invitation is invalid or has expired. Ask an administrator for a new invitation.");
        return;
      }
      window.history.replaceState({}, "", "/set-password");
      setMessage("");
      setReady(true);
    };
    void activate();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password.length < 8) {
      setMessage("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmation) {
      setMessage("The passwords do not match.");
      return;
    }
    setPending(true);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setPending(false);
      setMessage("Could not save your password. Reopen the invitation or request a new one.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  if (!ready) return <div className={styles.sessionNotice} role="status">{message}</div>;

  return (
    <form className={styles.form} onSubmit={submit}>
      {message ? <div className={styles.formError} role="alert">{message}</div> : null}
      {[
        ["password", "New password", "new-password"],
        ["confirmation", "Confirm password", "new-password"],
      ].map(([name, label, autoComplete]) => (
        <div className={styles.field} key={name}>
          <label htmlFor={name}>{label}</label>
          <div className={styles.inputWrap}>
            <LockKeyhole size={18} />
            <input
              id={name}
              name={name}
              type={showPassword ? "text" : "password"}
              autoComplete={autoComplete}
              minLength={8}
              required
              disabled={pending}
            />
            <button
              type="button"
              className={styles.reveal}
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide passwords" : "Show passwords"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
      ))}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? <><LoaderCircle className={styles.spinner} size={18} />Saving…</> : "Set password and continue"}
      </button>
    </form>
  );
}
