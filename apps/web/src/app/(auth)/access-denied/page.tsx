import Link from "next/link";
import { ShieldX, Sprout } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";

export default function AccessDeniedPage() {
  return (
    <main className="auth-message-page">
      <section className="auth-message-card">
        <span className="auth-message-card__brand"><Sprout size={19} /> FreshLens</span>
        <span className="auth-message-card__icon"><ShieldX size={30} /></span>
        <p className="auth-message-card__eyebrow">Access restricted</p>
        <h1>Administrator role required</h1>
        <p>
          This session is valid, but it is not provisioned for the platform
          administration workspace.
        </p>
        <form action={signOutAction}>
          <button type="submit" className="auth-message-card__primary">
            Sign out and use another account
          </button>
        </form>
        <Link href="/login">Return to sign in</Link>
      </section>
    </main>
  );
}
