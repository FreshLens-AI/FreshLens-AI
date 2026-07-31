export type TenantStatus = "active" | "inactive";
export type TenantPlan = "Starter" | "Growth" | "Pilot";
export type ProductStatus = "active" | "draft" | "archived";
export type Classification = "fresh" | "medium" | "spoiled";
export type ScanStatus = "pending" | "processing" | "completed" | "failed";
export type AlertType = "spoilage" | "low_stock" | "aging" | "other";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "active" | "acknowledged" | "dismissed";

export interface Tenant {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  status: TenantStatus;
  plan: TenantPlan;
  createdAt: string;
  lastActiveAt: string;
  memberCount: number;
  catalogueCoverage: number;
  scansThisMonth: number;
  spoilageRate: number;
  classificationMix: Record<Classification, number>;
  activeAlerts: number;
}

export interface Product {
  id: string;
  name: string;
  scientificName?: string;
  category: string;
  shelfLifeDays: number;
  status: ProductStatus;
  tenantCoverage: number;
  scansThisMonth: number;
  updatedAt: string;
  note?: string;
}

export interface ShelfLifeRule {
  id: string;
  category: string;
  defaultDays: number;
  productCount: number;
  updatedAt: string;
}

export interface Alert {
  id: string;
  tenantId: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
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

export interface TenantAggregate {
  tenantId: string;
  scans: number;
  fresh: number;
  medium: number;
  spoiled: number;
  activeAlerts: number;
}

export interface PipelineSummary {
  status: ScanStatus;
  count: number;
  helper: string;
}

export interface AdminActivity {
  id: string;
  action: string;
  subject: string;
  detail: string;
  createdAt: string;
  tone: "green" | "blue" | "amber" | "slate";
}

export interface TenantInput {
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  status: TenantStatus;
  plan: TenantPlan;
}

export interface ProductInput {
  name: string;
  scientificName?: string;
  category: string;
  shelfLifeDays: number;
  status: ProductStatus;
  note?: string;
}

export interface AlertInput {
  tenantId: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  productId?: string;
  batchReference?: string;
}
