"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Boxes, ShoppingBasket, ChartNoAxesCombined, Gauge, LogOut, Menu, RefreshCw, Sprout, Users, X } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";

const navigation = [
  { label: "Overview", href: "/workspace", icon: Gauge },
  { label: "Stock", href: "/workspace/stock", icon: Boxes },
  { label: "Sales", href: "/workspace/sales", icon: ShoppingBasket },
  { label: "Analytics", href: "/workspace/analytics", icon: ChartNoAxesCombined },
  { label: "Team", href: "/workspace/team", icon: Users },
];

export function WorkspaceShell({ owner, children }: {
  owner: { displayName: string; email: string | null };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const current = navigation.find((item) => pathname === item.href)?.label ?? "Workspace";
  return (
    <div className="admin-shell">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {open ? <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}
      <aside className={`sidebar${open ? " sidebar--open" : ""}`}>
        <div className="sidebar__brand-row">
          <Link href="/workspace" className="brand" onClick={() => setOpen(false)}>
            <span className="brand__mark"><Sprout size={22} /></span>
            <span><strong>FreshLens</strong><small>Tenant workspace</small></span>
          </Link>
          <button className="icon-button sidebar__close" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={20} /></button>
        </div>
        <nav className="sidebar__nav" aria-label="Tenant navigation">
          <div className="sidebar__group">
            <p className="sidebar__label">Your organization</p>
            <ul>{navigation.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return <li key={item.href}><Link href={item.href} className={`sidebar__link${active ? " sidebar__link--active" : ""}`} onClick={() => setOpen(false)}><Icon size={19} /><span>{item.label}</span></Link></li>;
            })}</ul>
          </div>
        </nav>
      </aside>
      <div className="admin-shell__body">
        <header className="topbar">
          <div className="topbar__left">
            <button className="icon-button topbar__menu" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={21} /></button>
            <div><p className="topbar__context">Tenant administration</p><p className="topbar__title">{current}</p></div>
          </div>
          <div className="topbar__actions">
            <span className="data-pill">Tenant private</span>
            <button className="icon-button" aria-label="Refresh data" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}><RefreshCw size={18} className={refreshing ? "is-spinning" : undefined} /></button>
            <div className="profile-chip"><span className="profile-chip__avatar">{owner.displayName.slice(0, 2).toUpperCase()}</span><span className="profile-chip__copy"><strong>{owner.displayName}</strong><small>{owner.email ?? "Tenant administrator"}</small></span></div>
            <form action={signOutAction}><button className="icon-button sign-out-button" aria-label="Sign out"><LogOut size={19} /></button></form>
          </div>
        </header>
        <main id="main-content" className="page-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
