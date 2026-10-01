import type { Metadata } from "next";
import { KeyRound, Sprout } from "lucide-react";

import { SetPasswordForm } from "@/components/auth/set-password-form";
import styles from "@/components/auth/login.module.css";

export const metadata: Metadata = { title: "Set your password" };

export default function SetPasswordPage() {
  return (
    <main className={styles.page}>
      <section className={styles.story} aria-label="FreshLens account setup">
        <div className={styles.brand}>
          <span className={styles.brandMark}><Sprout size={24} /></span>
          <span><strong>FreshLens</strong><small>Produce intelligence platform</small></span>
        </div>
        <div className={styles.storyCopy}>
          <p className={styles.eyebrow}>Secure account setup</p>
          <h1>Your private workspace is ready.</h1>
          <p>Create a password to activate your invited account and continue to FreshLens.</p>
        </div>
      </section>
      <section className={styles.panel} aria-labelledby="password-heading">
        <div className={styles.card}>
          <header className={styles.cardHeader}>
            <span><KeyRound size={12} /> Invitation verified</span>
            <h2 id="password-heading">Create your password</h2>
            <p>Use at least 8 characters. The eye button lets you verify what you entered.</p>
          </header>
          <SetPasswordForm />
        </div>
      </section>
    </main>
  );
}
