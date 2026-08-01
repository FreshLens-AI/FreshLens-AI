import type {
  AlertSeverity,
  AlertStatus,
  AlertType,
} from "@/types/domain";

export const alertTypeOptions: ReadonlyArray<{
  value: AlertType;
  label: string;
  description: string;
}> = [
  {
    value: "spoilage",
    label: "Spoilage",
    description: "A completed scan indicates spoiled produce.",
  },
  {
    value: "low_stock",
    label: "Low stock",
    description: "Remaining quantity is below a vendor-defined threshold.",
  },
  {
    value: "aging",
    label: "Aging",
    description: "A batch has crossed its configured shelf-life rule.",
  },
  {
    value: "other",
    label: "Other",
    description: "An operational notice outside the standard alert rules.",
  },
];

export const alertSeverityOptions: ReadonlyArray<{
  value: AlertSeverity;
  label: string;
  description: string;
}> = [
  {
    value: "info",
    label: "Info",
    description: "Awareness only; no urgent response is expected.",
  },
  {
    value: "warning",
    label: "Warning",
    description: "Review is recommended before the condition worsens.",
  },
  {
    value: "critical",
    label: "Critical",
    description: "Prompt operational attention is required.",
  },
];

export const alertStatusOptions: ReadonlyArray<{
  value: AlertStatus;
  label: string;
}> = [
  { value: "active", label: "Active" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "dismissed", label: "Dismissed" },
];

export function alertTypeLabel(value: AlertType) {
  return (
    alertTypeOptions.find((option) => option.value === value)?.label ?? value
  );
}

export function alertSeverityLabel(value: AlertSeverity) {
  return (
    alertSeverityOptions.find((option) => option.value === value)?.label ??
    value
  );
}

export function alertStatusLabel(value: AlertStatus) {
  return (
    alertStatusOptions.find((option) => option.value === value)?.label ?? value
  );
}
