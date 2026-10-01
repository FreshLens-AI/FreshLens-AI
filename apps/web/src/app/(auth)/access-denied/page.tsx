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
        <h1>This workspace is not available</h1>
        <p>
          Your session is valid, but its signed role does not allow this
          workspace. Vendor accounts continue in the FreshLens mobile app.
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
