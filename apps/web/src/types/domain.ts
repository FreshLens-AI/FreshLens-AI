export type TenantStatus = "active" | "inactive";
export type Classification = "fresh" | "medium" | "spoiled";
export type ScanStatus = "pending" | "processing" | "completed" | "failed";
export type AlertType = "spoilage" | "low_stock" | "aging" | "other";
export type AlertSeverity = "info" | "warning" | "critical";

export interface Tenant {
  id: string;
  name: string;
  ownerName: string | null;
  email: string | null;
  status: TenantStatus;
  createdAt: string;
  lastActiveAt: string | null;
  memberCount: number;
  catalogueCoverage: number;
  scansThisMonth: number;
  completedClassifications: number;
  classificationCounts: Record<Classification, number>;
  spoilageRate: number;
  classificationMix: Record<Classification, number>;
  activeAlerts: number;
}

export interface Product {
  id: string;
  tenantId: string;
  tenantName: string;
  name: string;
  shelfLifeDays: number;
  scansThisMonth: number;
  lowStockThreshold: number;
  updatedAt: string;
}

export interface Alert {
  id: string;
  tenantId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  productId?: string;
  batchReference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrendPoint {
  label: string;
  scans: number;
  fresh: number;
  medium: number;
  spoiled: number;
}

export interface PipelineSummary {
  status: ScanStatus;
  count: number;
  helper: string;
}

export interface AdminDataSnapshot {
  tenants: Tenant[];
  products: Product[];
  alerts: Alert[];
  trend: TrendPoint[];
  pipelineSummary: PipelineSummary[];
}
