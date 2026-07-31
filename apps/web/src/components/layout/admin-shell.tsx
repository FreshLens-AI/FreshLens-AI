"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Bell, Menu, RotateCcw, Sprout, X } from "lucide-react";

import { insightNavigation, primaryNavigation } from "@/lib/navigation";
import { useAdminData } from "@/store/admin-data-provider";

const pageNames = [...primaryNavigation, ...insightNavigation];

function NavigationGroup({
  label,
  items,
  pathname,
  onNavigate,
}: {
  label: string;
  items: typeof primaryNavigation;
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div className="sidebar__group">
      <p className="sidebar__label">{label}</p>
      <ul>
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`sidebar__link${active ? " sidebar__link--active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { alerts, resetDemoData } = useAdminData();
  const [open, setOpen] = useState(false);
  const activeAlerts = alerts.filter((alert) => alert.status === "active").length;
  const currentPage =
    pageNames.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.label ?? "Admin";

  return (
    <div className="admin-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {open ? (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside className={`sidebar${open ? " sidebar--open" : ""}`}>
        <div className="sidebar__brand-row">
          <Link href="/dashboard" className="brand" onClick={() => setOpen(false)}>
            <span className="brand__mark" aria-hidden="true">
              <Sprout size={22} strokeWidth={2.2} />
            </span>
            <span>
              <strong>FreshLens</strong>
              <small>Platform admin</small>
            </span>
          </Link>
          <button
            className="icon-button sidebar__close"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Primary navigation">
          <NavigationGroup
            label="Workspace"
            items={primaryNavigation}
            pathname={pathname}
            onNavigate={() => setOpen(false)}
          />
          <NavigationGroup
            label="Intelligence"
            items={insightNavigation}
            pathname={pathname}
            onNavigate={() => setOpen(false)}
          />
        </nav>

        <div className="sidebar__footer">
          <div className="demo-card">
            <span className="demo-card__icon" aria-hidden="true">
              <Sprout size={17} />
            </span>
            <div>
              <strong>Demo workspace</strong>
              <p>Typed local data · no backend</p>
            </div>
          </div>
          <button
            type="button"
            className="sidebar__reset"
            onClick={() => {
              if (window.confirm("Reset every local demo change and restore the original FreshLens fixtures?")) {
                resetDemoData();
              }
            }}
          >
            <RotateCcw size={13} aria-hidden="true" />
            Reset demo data
          </button>
          <p className="sidebar__version">FreshLens V1 · Group 21</p>
        </div>
      </aside>

      <div className="admin-shell__body">
        <header className="topbar">
          <div className="topbar__left">
            <button
              className="icon-button topbar__menu"
              aria-label="Open navigation"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <div>
              <p className="topbar__context">Platform workspace</p>
              <p className="topbar__title">{currentPage}</p>
            </div>
          </div>
          <div className="topbar__actions">
            <span className="data-pill">
              <span aria-hidden="true" />
              Live demo data
            </span>
            <Link href="/alerts" className="icon-button notification-button" aria-label={`${activeAlerts} active alerts`}>
              <Bell size={20} />
              {activeAlerts > 0 ? <span>{activeAlerts}</span> : null}
            </Link>
            <div className="profile-chip" aria-label="Platform admin profile">
              <span className="profile-chip__avatar">PA</span>
              <span className="profile-chip__copy">
                <strong>Platform Admin</strong>
                <small>Demo operator</small>
              </span>
            </div>
          </div>
        </header>

        <main id="main-content" className="page-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
