import type { Metadata } from "next";
import { LockKeyhole, ShieldCheck, Sprout } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

import styles from "@/components/auth/login.module.css";

export const metadata: Metadata = {
  title: "Admin sign in",
};

interface LoginPageProps {
  searchParams: Promise<{ reason?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const configured = isSupabaseConfigured();
  const reason = (await searchParams).reason;
  const sessionExpired =
    reason === "session-expired" ||
    (Array.isArray(reason) && reason.includes("session-expired"));

  return (
    <main className={styles.page}>
      <section className={styles.story} aria-label="FreshLens platform overview">
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <Sprout size={24} />
          </span>
          <span>
            <strong>FreshLens</strong>
            <small>Produce intelligence platform</small>
          </span>
        </div>

        <div className={styles.storyCopy}>
          <p className={styles.eyebrow}>Platform administration</p>
          <h1>Clear oversight for fresher decisions.</h1>
          <p>
            Manage tenant operations, catalogue standards, shelf-life rules, and
            privacy-safe platform intelligence from one focused workspace.
          </p>
        </div>

        <div className={styles.privacy}>
          <ShieldCheck size={22} aria-hidden="true" />
          <div>
            <strong>Designed around tenant privacy</strong>
            <p>
              Administrator access is role-gated and never exposes raw vendor
              scans, images, quantities, or inventory records.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="login-heading">
        <div className={styles.card}>
          <header className={styles.cardHeader}>
            <span><LockKeyhole size={12} /> Restricted access</span>
            <h2 id="login-heading">Welcome back</h2>
            <p>
              Sign in with the administrator account provisioned by your
              FreshLens project owner.
            </p>
          </header>

          {!configured ? (
            <div className={styles.configWarning} role="status">
              Supabase is not configured. Copy <code>.env.example</code> to
              <code> .env.local</code> and add your project values.
            </div>
          ) : null}

          {sessionExpired ? (
            <div className={styles.sessionNotice} role="alert">
              Your session has expired or is no longer valid. Sign in again to
              continue.
            </div>
          ) : null}

          <LoginForm configured={configured} />
          <p className={styles.help}>
            Administrator accounts are provisioned by a FreshLens project
            owner. This workspace does not provide a signup flow.
          </p>
        </div>
      </section>
    </main>
  );
}
