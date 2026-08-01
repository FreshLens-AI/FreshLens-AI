"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import styles from "./alerts.module.css";

export type AlertLifecycleAction = "acknowledge" | "dismiss";

export function ConfirmAlertAction({
  action,
  alertTitle,
  onCancel,
  onConfirm,
}: {
  action: AlertLifecycleAction;
  alertTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const dismissing = action === "dismiss";
  const title = dismissing ? "Dismiss this alert?" : "Acknowledge this alert?";
  const description = dismissing
    ? "The record will remain in alert history, but it will no longer appear as active. This demo does not permanently delete alerts."
    : "This marks the alert as reviewed while keeping it available for follow-up and later dismissal.";

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    return () => previousFocus?.focus();
  }, []);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className={styles.dialogBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-action-title"
        aria-describedby="alert-action-description"
        onKeyDown={handleDialogKeyDown}
      >
        <button
          type="button"
          className={styles.dialogClose}
          aria-label="Cancel action"
          onClick={onCancel}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <span
          className={`${styles.dialogIcon} ${
            dismissing ? styles.dialogIconDanger : styles.dialogIconSuccess
          }`}
          aria-hidden="true"
        >
          {dismissing ? (
            <AlertTriangle size={23} />
          ) : (
            <CheckCircle2 size={23} />
          )}
        </span>
        <p className={styles.dialogEyebrow}>
          {dismissing ? "Lifecycle action" : "Review confirmation"}
        </p>
        <h2 id="alert-action-title">{title}</h2>
        <p id="alert-action-description">{description}</p>
        <div className={styles.dialogSubject}>
          <span>Alert</span>
          <strong>{alertTitle}</strong>
        </div>
        <div className={styles.dialogActions}>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={dismissing ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            autoFocus
          >
            {dismissing ? "Dismiss alert" : "Acknowledge alert"}
          </Button>
        </div>
      </section>
    </div>
  );
}
