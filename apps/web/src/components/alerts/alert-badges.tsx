import { Badge, type BadgeTone } from "@/components/ui/badge";
import type {
  AlertSeverity,
  AlertStatus,
  AlertType,
} from "@/types/domain";

import {
  alertSeverityLabel,
  alertStatusLabel,
  alertTypeLabel,
} from "./alert-options";

const typeTones: Record<AlertType, BadgeTone> = {
  spoilage: "danger",
  low_stock: "warning",
  aging: "info",
  other: "neutral",
};

const severityTones: Record<AlertSeverity, BadgeTone> = {
  info: "info",
  warning: "warning",
  critical: "danger",
};

const statusTones: Record<AlertStatus, BadgeTone> = {
  active: "danger",
  acknowledged: "brand",
  dismissed: "neutral",
};

export function AlertTypeBadge({ type }: { type: AlertType }) {
  return <Badge tone={typeTones[type]}>{alertTypeLabel(type)}</Badge>;
}

export function AlertSeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <Badge tone={severityTones[severity]}>
      {alertSeverityLabel(severity)}
    </Badge>
  );
}

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return <Badge tone={statusTones[status]}>{alertStatusLabel(status)}</Badge>;
}
