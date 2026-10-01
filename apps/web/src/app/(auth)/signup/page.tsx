import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Sprout } from "lucide-react";

import { SignupForm } from "@/components/auth/signup-form";
import styles from "@/components/auth/login.module.css";

export const metadata: Metadata = { title: "Apply for FreshLens" };

export default function SignupPage() {
  return (
    <main className={styles.page}>
      <section className={styles.story} aria-label="FreshLens tenant signup">
        <div className={styles.brand}>
          <span className={styles.brandMark}><Sprout size={24} /></span>
          <span><strong>FreshLens</strong><small>Produce intelligence platform</small></span>
        </div>
        <div className={styles.storyCopy}>
          <p className={styles.eyebrow}>Tenant application</p>
          <h1>Bring fresher decisions to your store.</h1>
          <p>Tell us who you are. We review each organization before creating its private workspace and owner account.</p>
        </div>
      </section>
      <section className={styles.panel} aria-labelledby="signup-heading">
        <div className={styles.card}>
          <header className={styles.cardHeader}>
            <span><ClipboardCheck size={12} /> Reviewed onboarding</span>
            <h2 id="signup-heading">Apply for an account</h2>
            <p>No password is needed yet. If approved, the owner receives a secure password-setup link.</p>
          </header>
          <SignupForm />
          <p className={styles.help}>Already approved? <Link href="/login">Sign in</Link>.</p>
        </div>
      </section>
    </main>
  );
}
