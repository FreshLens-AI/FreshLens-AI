import type { BadgeTone } from "@/components/ui/badge";
import type {
  AlertSeverity,
  ScanStatus,
  TenantStatus,
} from "@/types/domain";

export function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function tenantTone(status: TenantStatus): BadgeTone {
  return status === "active" ? "success" : "neutral";
}

export function alertSeverityTone(severity: AlertSeverity): BadgeTone {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}

export function scanStatusTone(status: ScanStatus): BadgeTone {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "processing") return "info";
  return "warning";
}
