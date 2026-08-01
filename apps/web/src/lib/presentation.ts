import type { BadgeTone } from "@/components/ui/badge";
import type {
  AlertSeverity,
  AlertStatus,
  AlertType,
  Classification,
  ProductStatus,
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

export function productTone(status: ProductStatus): BadgeTone {
  if (status === "active") return "success";
  if (status === "draft") return "warning";
  return "neutral";
}

export function alertSeverityTone(severity: AlertSeverity): BadgeTone {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}

export function alertStatusTone(status: AlertStatus): BadgeTone {
  if (status === "active") return "danger";
  if (status === "acknowledged") return "warning";
  return "neutral";
}

export function alertTypeTone(type: AlertType): BadgeTone {
  if (type === "spoilage") return "danger";
  if (type === "aging") return "warning";
  if (type === "low_stock") return "info";
  return "neutral";
}

export function scanStatusTone(status: ScanStatus): BadgeTone {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "processing") return "info";
  return "warning";
}

export function classificationTone(value: Classification): BadgeTone {
  if (value === "fresh") return "success";
  if (value === "medium") return "warning";
  return "danger";
}
