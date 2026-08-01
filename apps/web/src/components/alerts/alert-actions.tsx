"use client";

import { useState } from "react";
import { ArchiveX, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAdminData } from "@/store/admin-data-provider";
import type { Alert } from "@/types/domain";

import {
  ConfirmAlertAction,
  type AlertLifecycleAction,
} from "./confirm-alert-action";
import styles from "./alerts.module.css";

export function AlertActions({
  alert,
  compact = false,
}: {
  alert: Alert;
  compact?: boolean;
}) {
  const { acknowledgeAlert, dismissAlert } = useAdminData();
  const [pendingAction, setPendingAction] =
    useState<AlertLifecycleAction | null>(null);

  if (alert.status === "dismissed") {
    return <span className={styles.noActions}>No actions available</span>;
  }

  return (
    <>
      <div className={compact ? styles.compactActions : styles.lifecycleActions}>
        {alert.status === "active" ? (
          <Button
            type="button"
            variant="secondary"
            size={compact ? "sm" : "md"}
            icon={<CheckCircle2 size={16} aria-hidden="true" />}
            onClick={() => setPendingAction("acknowledge")}
          >
            Acknowledge
          </Button>
        ) : null}
        <Button
          type="button"
          variant="danger"
          size={compact ? "sm" : "md"}
          icon={<ArchiveX size={16} aria-hidden="true" />}
          onClick={() => setPendingAction("dismiss")}
        >
          Dismiss
        </Button>
      </div>

      {pendingAction ? (
        <ConfirmAlertAction
          action={pendingAction}
          alertTitle={alert.title}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            if (pendingAction === "acknowledge") acknowledgeAlert(alert.id);
            else dismissAlert(alert.id);
          }}
        />
      ) : null}
    </>
  );
}
